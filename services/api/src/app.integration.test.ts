import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "./app";
import { disconnectPrisma, prismaAdmin } from "./db/prisma";
import {
  getRegistrationCodeForTest,
  registerTestUser,
  sendRegistrationCodeForTest,
} from "./test/registerHelper";

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
  const response = await registerTestUser(app, email, { name });

  expect(response.status).toBe(201);

  if (!response.body.token) {
    throw new Error(
      "Bearer integration tests require ALLOW_AUTH_TOKEN_RESPONSE=true in .env.test.",
    );
  }

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
  await prismaAdmin.activityRecipient.deleteMany();
  await prismaAdmin.activityEvent.deleteMany();
  await prismaAdmin.billShare.deleteMany();
  await prismaAdmin.bill.deleteMany();
  await prismaAdmin.groupInvitation.deleteMany();
  await prismaAdmin.friendInvitation.deleteMany();
  await prismaAdmin.friendship.deleteMany();
  await prismaAdmin.groupMember.deleteMany();
  await prismaAdmin.group.deleteMany();
  await prismaAdmin.session.deleteMany();
  await prismaAdmin.emailVerification.deleteMany();
  await prismaAdmin.user.deleteMany();
});

afterAll(async () => {
  await disconnectPrisma();
});

describe("authentication API", () => {
  it("registers a normalized local user and never returns the password hash", async () => {
    await sendRegistrationCodeForTest(app, "  Owner@Example.com ");
    const code = getRegistrationCodeForTest("owner@example.com");

    const response = await request(app).post("/auth/register").send({
      email: "  Owner@Example.com ",
      name: "Owner",
      password: "secure-password",
      code,
    });

    expect(response.status).toBe(201);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({
      email: "owner@example.com",
      name: "Owner",
    });
    expect(response.body.user).not.toHaveProperty("passwordHash");
    expect(response.body.user).not.toHaveProperty("authProvider");

    const user = await prismaAdmin.user.findUniqueOrThrow({
      where: { email: "owner@example.com" },
    });
    expect(user.passwordHash).not.toBe("secure-password");
    expect(user.authProvider).toBe("local");
    expect(user.emailVerifiedAt).not.toBeNull();
  });

  it("rejects invalid registration input and duplicate normalized emails", async () => {
    const invalid = await request(app)
      .post("/auth/register")
      .send({ email: "bad-email", password: "short", code: "123456" });

    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");

    await register("member@example.com");
    const duplicate = await request(app)
      .post("/auth/register/send-code")
      .send({ email: " MEMBER@example.com " });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("EMAIL_ALREADY_REGISTERED");
  });

  it("requires a valid verification code before creating an account", async () => {
    await sendRegistrationCodeForTest(app, "verify@example.com");

    const missingCode = await request(app).post("/auth/register").send({
      email: "verify@example.com",
      password: "secure-password",
    });

    expect(missingCode.status).toBe(400);
    expect(missingCode.body.error.code).toBe("VALIDATION_ERROR");

    const wrongCode = await request(app).post("/auth/register").send({
      email: "verify@example.com",
      password: "secure-password",
      code: "000000",
    });

    expect(wrongCode.status).toBe(400);
    expect(wrongCode.body.error.code).toBe("VERIFICATION_CODE_INVALID");
  });

  it("locks out verification after too many incorrect attempts", async () => {
    await sendRegistrationCodeForTest(app, "attempts@example.com");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app).post("/auth/register").send({
        email: "attempts@example.com",
        password: "secure-password",
        code: "000000",
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VERIFICATION_CODE_INVALID");
    }

    const locked = await request(app).post("/auth/register").send({
      email: "attempts@example.com",
      password: "secure-password",
      code: "000000",
    });

    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe("VERIFICATION_ATTEMPTS_EXCEEDED");
  });

  it("rejects expired verification codes", async () => {
    await sendRegistrationCodeForTest(app, "expired@example.com");

    await prismaAdmin.emailVerification.updateMany({
      where: { email: "expired@example.com" },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const response = await request(app).post("/auth/register").send({
      email: "expired@example.com",
      password: "secure-password",
      code: getRegistrationCodeForTest("expired@example.com"),
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VERIFICATION_CODE_INVALID");
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
    await prismaAdmin.user.create({
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

  it("revokes sessions after logout", async () => {
    const account = await register("logout@example.com");
    const authenticated = await request(app).get("/auth/me").set(bearer(account.token));

    expect(authenticated.status).toBe(200);

    await request(app).post("/auth/logout").set(bearer(account.token));

    const afterLogout = await request(app).get("/auth/me").set(bearer(account.token));
    expect(afterLogout.status).toBe(401);
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
    expect(missingUser.status).toBe(201);
    expect(missingUser.body.invitation.recipientEmail).toBe("missing@example.com");
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

  it("stores pending email invites and delivers them after registration", async () => {
    const sender = await register("inviter@example.com");

    const invitation = await request(app)
      .post("/friend-invitations")
      .set(bearer(sender.token))
      .send({ email: "future-friend@example.com" });

    expect(invitation.status).toBe(201);
    expect(invitation.body.invitation.recipientEmail).toBe("future-friend@example.com");
    expect(invitation.body.invitation.recipient).toBeNull();

    const recipient = await register("future-friend@example.com");
    const received = await request(app).get("/invitations").set(bearer(recipient.token));
    const accepted = await request(app)
      .patch(`/friend-invitations/${invitation.body.invitation.id as string}`)
      .set(bearer(recipient.token))
      .send({ decision: "accept" });
    const friends = await request(app).get("/friends").set(bearer(sender.token));

    expect(received.body.receivedFriends).toHaveLength(1);
    expect(accepted.body.invitation.status).toBe("accepted");
    expect(friends.body.friends).toHaveLength(1);
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

  it("accepts custom friendship shares and updates dashboard balances", async () => {
    const payer = await register("payer@example.com");
    const friend = await register("friend@example.com");
    const friendshipId = await becomeFriends(payer, friend);

    const created = await request(app).post("/bills").set(bearer(payer.token)).send({
      description: "Custom dinner",
      incurredAt: "2026-05-25",
      totalCents: 10_000,
      targetType: "friendship",
      targetId: friendshipId,
      payerId: payer.user.id,
      shares: [
        { userId: payer.user.id, shareCents: 7000 },
        { userId: friend.user.id, shareCents: 3000 },
      ],
    });
    const friendDashboard = await request(app).get("/dashboard").set(bearer(friend.token));

    expect(created.status).toBe(201);
    expect(
      created.body.bill.shares
        .map((share: { userId: string; shareCents: number }) => share.shareCents)
        .sort(),
    ).toEqual([3000, 7000]);
    expect(friendDashboard.body.dashboard.totalYouOweCents).toBe(3000);
  });

  it("supports partial group membership in custom shares", async () => {
    const owner = await register("owner-split@example.com");
    const member = await register("member-split@example.com");
    const excluded = await register("excluded-split@example.com");
    const group = await request(app)
      .post("/groups")
      .set(bearer(owner.token))
      .send({ name: "Trip" });

    for (const account of [member, excluded]) {
      const invitation = await request(app)
        .post(`/groups/${group.body.group.id as string}/invitations`)
        .set(bearer(owner.token))
        .send({ email: account.user.email });
      await request(app)
        .patch(`/group-invitations/${invitation.body.invitation.id as string}`)
        .set(bearer(account.token))
        .send({ decision: "accept" });
    }

    const bill = await request(app).post("/bills").set(bearer(owner.token)).send({
      description: "Partial dinner",
      incurredAt: "2026-05-25",
      totalCents: 3000,
      targetType: "group",
      targetId: group.body.group.id,
      payerId: owner.user.id,
      shares: [
        { userId: owner.user.id, shareCents: 1500 },
        { userId: member.user.id, shareCents: 1500 },
      ],
    });
    const excludedDashboard = await request(app).get("/dashboard").set(bearer(excluded.token));

    expect(bill.status).toBe(201);
    expect(bill.body.bill.shares).toHaveLength(2);
    expect(excludedDashboard.body.dashboard.balances).toHaveLength(0);
  });

  it("rejects invalid custom share payloads", async () => {
    const first = await register("invalid-first@example.com");
    const second = await register("invalid-second@example.com");
    const friendshipId = await becomeFriends(first, second);

    const mismatch = await request(app).post("/bills").set(bearer(first.token)).send({
      description: "Mismatch",
      incurredAt: "2026-05-25",
      totalCents: 1000,
      targetType: "friendship",
      targetId: friendshipId,
      payerId: first.user.id,
      shares: [
        { userId: first.user.id, shareCents: 400 },
        { userId: second.user.id, shareCents: 400 },
      ],
    });
    const payerExcluded = await request(app).post("/bills").set(bearer(first.token)).send({
      description: "Payer excluded",
      incurredAt: "2026-05-25",
      totalCents: 1000,
      targetType: "friendship",
      targetId: friendshipId,
      payerId: first.user.id,
      shares: [{ userId: second.user.id, shareCents: 1000 }],
    });
    const payerExcludedDashboard = await request(app)
      .get("/dashboard")
      .set(bearer(second.token));

    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error.code).toBe("INVALID_SHARE_TOTAL");
    expect(payerExcluded.status).toBe(201);
    expect(payerExcluded.body.bill.shares).toHaveLength(1);
    expect(payerExcludedDashboard.body.dashboard.totalYouOweCents).toBe(1000);
  });

  it("rejects a payer who is not a participant in the target", async () => {
    const first = await register("payer-first@example.com");
    const second = await register("payer-second@example.com");
    const outsider = await register("payer-outsider@example.com");
    const friendshipId = await becomeFriends(first, second);

    const friendshipBill = await request(app).post("/bills").set(bearer(first.token)).send({
      description: "Invalid payer",
      incurredAt: "2026-05-25",
      totalCents: 1000,
      targetType: "friendship",
      targetId: friendshipId,
      payerId: outsider.user.id,
    });

    const group = await request(app)
      .post("/groups")
      .set(bearer(first.token))
      .send({ name: "Payer validation group" });
    const groupBill = await request(app).post("/bills").set(bearer(first.token)).send({
      description: "Invalid group payer",
      incurredAt: "2026-05-25",
      totalCents: 1000,
      targetType: "group",
      targetId: group.body.group.id,
      payerId: outsider.user.id,
    });

    expect(friendshipBill.status).toBe(400);
    expect(friendshipBill.body.error.code).toBe("INVALID_PAYER");
    expect(groupBill.status).toBe(400);
    expect(groupBill.body.error.code).toBe("INVALID_PAYER");
  });
});

describe("friend detail shared group bills", () => {
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

  async function addToGroup(
    owner: RegisteredAccount,
    member: RegisteredAccount,
    groupId: string,
  ) {
    const invitation = await request(app)
      .post(`/groups/${groupId}/invitations`)
      .set(bearer(owner.token))
      .send({ email: member.user.email });
    await request(app)
      .patch(`/group-invitations/${invitation.body.invitation.id as string}`)
      .set(bearer(member.token))
      .send({ decision: "accept" });
  }

  it("returns pairwise group bills on GET /friends/:id", async () => {
    const you = await register("pairwise-you@example.com");
    const friend = await register("pairwise-friend@example.com");
    const third = await register("pairwise-third@example.com");
    const friendshipId = await becomeFriends(you, friend);
    const group = await request(app)
      .post("/groups")
      .set(bearer(you.token))
      .send({ name: "Roommates" });

    await addToGroup(you, friend, group.body.group.id as string);
    await addToGroup(you, third, group.body.group.id as string);

    await request(app).post("/bills").set(bearer(you.token)).send({
      description: "Groceries",
      incurredAt: "2026-05-25",
      totalCents: 3000,
      targetType: "group",
      targetId: group.body.group.id,
      payerId: you.user.id,
      shares: [
        { userId: you.user.id, shareCents: 1000 },
        { userId: friend.user.id, shareCents: 1000 },
        { userId: third.user.id, shareCents: 1000 },
      ],
    });
    await request(app).post("/bills").set(bearer(you.token)).send({
      description: "Hidden third-party payer",
      incurredAt: "2026-05-25",
      totalCents: 2000,
      targetType: "group",
      targetId: group.body.group.id,
      payerId: third.user.id,
      shares: [
        { userId: you.user.id, shareCents: 1000 },
        { userId: friend.user.id, shareCents: 1000 },
      ],
    });
    await request(app).post("/bills").set(bearer(friend.token)).send({
      description: "Coffee",
      incurredAt: "2026-05-25",
      totalCents: 800,
      targetType: "group",
      targetId: group.body.group.id,
      payerId: friend.user.id,
      shares: [
        { userId: friend.user.id, shareCents: 400 },
        { userId: you.user.id, shareCents: 400 },
      ],
    });

    const detail = await request(app).get(`/friends/${friendshipId}`).set(bearer(you.token));

    expect(detail.status).toBe(200);
    expect(detail.body.friendship.sharedGroups).toHaveLength(1);
    expect(detail.body.friendship.sharedGroups[0].name).toBe("Roommates");
    expect(detail.body.friendship.sharedGroups[0].bills).toHaveLength(2);

    const groceries = detail.body.friendship.sharedGroups[0].bills.find(
      (bill: { description: string }) => bill.description === "Groceries",
    );
    const coffee = detail.body.friendship.sharedGroups[0].bills.find(
      (bill: { description: string }) => bill.description === "Coffee",
    );

    expect(groceries.pairwise).toMatchObject({
      direction: "friend_owes_you",
      amountCents: 1000,
    });
    expect(coffee.pairwise).toMatchObject({
      direction: "you_owe_friend",
      amountCents: 400,
    });
    expect(
      detail.body.friendship.sharedGroups[0].bills.some(
        (bill: { description: string }) => bill.description === "Hidden third-party payer",
      ),
    ).toBe(false);
  });
});
