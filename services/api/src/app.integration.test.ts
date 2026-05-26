import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "./app";
import { prisma } from "./db/prisma";

type RegisteredAccount = {
  token: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: string;
  };
};

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function register(email: string, name?: string): Promise<RegisteredAccount> {
  const response = await request(app)
    .post("/auth/register")
    .send({ email, password: "secure-password", ...(name ? { name } : {}) });

  expect(response.status).toBe(201);
  return response.body as RegisteredAccount;
}

beforeAll(() => {
  if (
    process.env.NODE_ENV !== "test" ||
    process.env.ALLOW_TEST_DATABASE_RESET !== "true" ||
    !process.env.DATABASE_URL
  ) {
    throw new Error(
      "Integration tests require an explicit resettable test database in .env.test.",
    );
  }
});

beforeEach(async () => {
  await prisma.activityRecipient.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.billShare.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.groupInvitation.deleteMany();
  await prisma.friendInvitation.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("authentication API", () => {
  it("registers a normalized local user and never returns the password hash", async () => {
    const response = await request(app).post("/auth/register").send({
      email: "  Owner@Example.com ",
      name: "Owner",
      password: "secure-password",
    });

    expect(response.status).toBe(201);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({
      email: "owner@example.com",
      name: "Owner",
    });
    expect(response.body.user).not.toHaveProperty("passwordHash");
    expect(response.body.user).not.toHaveProperty("authProvider");

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "owner@example.com" },
    });
    expect(user.passwordHash).not.toBe("secure-password");
    expect(user.authProvider).toBe("local");
  });

  it("rejects invalid registration input and duplicate normalized emails", async () => {
    const invalid = await request(app)
      .post("/auth/register")
      .send({ email: "bad-email", password: "short" });

    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");

    await register("member@example.com");
    const duplicate = await request(app)
      .post("/auth/register")
      .send({ email: " MEMBER@example.com ", password: "secure-password" });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("EMAIL_ALREADY_REGISTERED");
  });

  it("logs in valid users and gives a generic error for invalid local credentials", async () => {
    await register("login@example.com");

    const success = await request(app)
      .post("/auth/login")
      .send({ email: " LOGIN@example.com ", password: "secure-password" });
    const wrongPassword = await request(app)
      .post("/auth/login")
      .send({ email: "login@example.com", password: "wrong-password" });
    const unknownUser = await request(app)
      .post("/auth/login")
      .send({ email: "unknown@example.com", password: "wrong-password" });

    expect(success.status).toBe(200);
    expect(success.body.token).toEqual(expect.any(String));
    expect(success.body.user).not.toHaveProperty("passwordHash");
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe("Invalid email or password");
    expect(unknownUser.body.error.message).toBe("Invalid email or password");
  });

  it("rejects password login for a provider user without a password hash", async () => {
    await prisma.user.create({
      data: {
        email: "google@example.com",
        name: "Google User",
        authProvider: "google",
        providerUserId: "google-identity",
        passwordHash: null,
      },
    });

    const response = await request(app)
      .post("/auth/login")
      .send({ email: "google@example.com", password: "any-password" });

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe("Invalid email or password");
  });

  it("returns the current user only for a valid token", async () => {
    const account = await register("me@example.com", "Me");
    const success = await request(app).get("/auth/me").set(bearer(account.token));
    const missing = await request(app).get("/auth/me");
    const invalid = await request(app)
      .get("/auth/me")
      .set(bearer("invalid-token"));

    expect(success.status).toBe(200);
    expect(success.body.user).toMatchObject({ email: "me@example.com", name: "Me" });
    expect(success.body.user).not.toHaveProperty("passwordHash");
    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
  });
});

describe("group authorization API", () => {
  it("creates an owner membership from the authenticated user and lists only memberships", async () => {
    const owner = await register("owner@example.com");
    const outsider = await register("outsider@example.com");

    const rejectedIdentityOverride = await request(app)
      .post("/groups")
      .set(bearer(owner.token))
      .send({ name: "Wrong Group", userId: outsider.user.id });
    const created = await request(app)
      .post("/groups")
      .set(bearer(owner.token))
      .send({ name: "Cabin Trip" });

    expect(rejectedIdentityOverride.status).toBe(400);
    expect(created.status).toBe(201);
    expect(created.body.group.role).toBe("owner");

    const ownerGroups = await request(app).get("/groups").set(bearer(owner.token));
    const outsiderGroups = await request(app).get("/groups").set(bearer(outsider.token));

    expect(ownerGroups.body.groups).toHaveLength(1);
    expect(ownerGroups.body.groups[0]).toMatchObject({ name: "Cabin Trip", role: "owner" });
    expect(outsiderGroups.body.groups).toEqual([]);
  });

  it("adds group members only after a registered recipient accepts an invitation", async () => {
    const owner = await register("owner@example.com");
    const member = await register("member@example.com");
    const nextMember = await register("next@example.com");
    const outsider = await register("outsider@example.com");
    const created = await request(app)
      .post("/groups")
      .set(bearer(owner.token))
      .send({ name: "Dinner Club" });
    const groupId = created.body.group.id as string;

    const invitation = await request(app)
      .post(`/groups/${groupId}/invitations`)
      .set(bearer(owner.token))
      .send({ email: " MEMBER@example.com " });
    const directAddition = await request(app)
      .post(`/groups/${groupId}/members`)
      .set(bearer(owner.token))
      .send({ email: nextMember.user.email });
    const beforeAcceptance = await request(app)
      .get(`/groups/${groupId}`)
      .set(bearer(member.token));
    const memberInvites = await request(app)
      .post(`/groups/${groupId}/invitations`)
      .set(bearer(member.token))
      .send({ email: nextMember.user.email });
    const acceptance = await request(app)
      .patch(`/group-invitations/${invitation.body.invitation.id as string}`)
      .set(bearer(member.token))
      .send({ decision: "accept" });
    const memberView = await request(app)
      .get(`/groups/${groupId}`)
      .set(bearer(member.token));
    const outsiderView = await request(app)
      .get(`/groups/${groupId}`)
      .set(bearer(outsider.token));
    const acceptedMemberInvitation = await request(app)
      .post(`/groups/${groupId}/invitations`)
      .set(bearer(member.token))
      .send({ email: nextMember.user.email });
    const missingUser = await request(app)
      .post(`/groups/${groupId}/invitations`)
      .set(bearer(owner.token))
      .send({ email: "missing@example.com" });
    const duplicate = await request(app)
      .post(`/groups/${groupId}/invitations`)
      .set(bearer(owner.token))
      .send({ email: member.user.email });

    expect(invitation.status).toBe(201);
    expect(directAddition.status).toBe(404);
    expect(beforeAcceptance.status).toBe(403);
    expect(memberInvites.status).toBe(403);
    expect(acceptance.status).toBe(200);
    expect(acceptance.body.invitation.status).toBe("accepted");
    expect(memberView.status).toBe(200);
    expect(memberView.body.group.members).toHaveLength(2);
    expect(outsiderView.status).toBe(403);
    expect(acceptedMemberInvitation.status).toBe(201);
    expect(missingUser.status).toBe(404);
    expect(duplicate.status).toBe(409);
  });
});

describe("friend invitation API", () => {
  it("requires acceptance before a friendship can be used for direct bills", async () => {
    const sender = await register("sender@example.com");
    const recipient = await register("recipient@example.com");

    const invitation = await request(app)
      .post("/friend-invitations")
      .set(bearer(sender.token))
      .send({ email: recipient.user.email });
    const prematureBill = await request(app)
      .post("/bills")
      .set(bearer(sender.token))
      .send({
        description: "Coffee",
        incurredAt: "2026-05-25",
        totalCents: 800,
        targetType: "friendship",
        targetId: "00000000-0000-0000-0000-000000000000",
        payerId: sender.user.id,
      });
    const received = await request(app).get("/invitations").set(bearer(recipient.token));
    const accepted = await request(app)
      .patch(`/friend-invitations/${invitation.body.invitation.id as string}`)
      .set(bearer(recipient.token))
      .send({ decision: "accept" });
    const friends = await request(app).get("/friends").set(bearer(sender.token));

    expect(invitation.status).toBe(201);
    expect(received.body.receivedFriends).toHaveLength(1);
    expect(prematureBill.status).toBe(403);
    expect(accepted.body.invitation.status).toBe("accepted");
    expect(friends.body.friends[0].friend.email).toBe(recipient.user.email);
  });
});

describe("bill ledger and dashboard API", () => {
  async function becomeFriends(first: RegisteredAccount, second: RegisteredAccount) {
    const invitation = await request(app)
      .post("/friend-invitations")
      .set(bearer(first.token))
      .send({ email: second.user.email });
    await request(app)
      .patch(`/friend-invitations/${invitation.body.invitation.id as string}`)
      .set(bearer(second.token))
      .send({ decision: "accept" });
    const friends = await request(app).get("/friends").set(bearer(first.token));
    return friends.body.friends[0].id as string;
  }

  it("stores explicit equal shares, permits friend corrections, and removes deleted balances", async () => {
    const first = await register("first@example.com");
    const second = await register("second@example.com");
    const friendshipId = await becomeFriends(first, second);

    const created = await request(app).post("/bills").set(bearer(first.token)).send({
      description: "Odd total",
      incurredAt: "2026-05-25",
      totalCents: 1001,
      targetType: "friendship",
      targetId: friendshipId,
      payerId: first.user.id,
    });
    const dashboardAfterCreate = await request(app)
      .get("/dashboard")
      .set(bearer(first.token));
    const updated = await request(app)
      .patch(`/bills/${created.body.bill.id as string}`)
      .set(bearer(second.token))
      .send({
        description: "Corrected total",
        incurredAt: "2026-05-25",
        totalCents: 1000,
        targetType: "friendship",
        targetId: friendshipId,
        payerId: second.user.id,
      });
    const dashboardAfterUpdate = await request(app)
      .get("/dashboard")
      .set(bearer(first.token));
    const deleted = await request(app)
      .delete(`/bills/${created.body.bill.id as string}`)
      .set(bearer(second.token));
    const dashboardAfterDelete = await request(app)
      .get("/dashboard")
      .set(bearer(first.token));

    expect(created.status).toBe(201);
    expect(created.body.bill.shares.map((share: { shareCents: number }) => share.shareCents).sort())
      .toEqual([500, 501]);
    expect(dashboardAfterCreate.body.dashboard.totalOwedToYouCents).toBe(500);
    expect(updated.body.bill.payer.id).toBe(second.user.id);
    expect(dashboardAfterUpdate.body.dashboard.totalYouOweCents).toBe(500);
    expect(deleted.status).toBe(204);
    expect(dashboardAfterDelete.body.dashboard.balances[0].balanceCents).toBe(0);
  });

  it("shows group-only contacts, snapshots shares, and protects retargeting", async () => {
    const owner = await register("owner@example.com");
    const member = await register("member@example.com");
    const outsider = await register("outsider@example.com");
    const friendshipId = await becomeFriends(member, outsider);
    const group = await request(app)
      .post("/groups")
      .set(bearer(owner.token))
      .send({ name: "Weekend" });
    const invitation = await request(app)
      .post(`/groups/${group.body.group.id as string}/invitations`)
      .set(bearer(owner.token))
      .send({ email: member.user.email });
    await request(app)
      .patch(`/group-invitations/${invitation.body.invitation.id as string}`)
      .set(bearer(member.token))
      .send({ decision: "accept" });
    const bill = await request(app).post("/bills").set(bearer(owner.token)).send({
      description: "Cabin",
      incurredAt: "2026-05-25",
      totalCents: 2000,
      targetType: "group",
      targetId: group.body.group.id,
      payerId: member.user.id,
    });
    const ownerDashboard = await request(app).get("/dashboard").set(bearer(owner.token));
    const retargetedByMember = await request(app)
      .patch(`/bills/${bill.body.bill.id as string}`)
      .set(bearer(member.token))
      .send({
        description: "Moved Cabin",
        incurredAt: "2026-05-25",
        totalCents: 2000,
        targetType: "friendship",
        targetId: friendshipId,
        payerId: member.user.id,
      });
    const activity = await request(app).get("/activity").set(bearer(owner.token));

    expect(bill.status).toBe(201);
    expect(bill.body.bill.shares).toHaveLength(2);
    expect(ownerDashboard.body.dashboard.balances[0]).toMatchObject({
      relationship: "group",
      balanceCents: -1000,
    });
    expect(retargetedByMember.status).toBe(403);
    expect(activity.body.activity.some((event: { type: string }) => event.type === "BILL_CREATED"))
      .toBe(true);
  });
});
