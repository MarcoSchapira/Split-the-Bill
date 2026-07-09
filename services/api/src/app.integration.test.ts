import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "./app";
import { disconnectPrisma, prismaAdmin } from "./db/prisma";
import {
  getRegistrationCodeForTest,
  registerTestUser,
  sendRegistrationCodeForTest,
} from "./test/registerHelper";
import { MOBILE_CLIENT_HEADER, MOBILE_CLIENT_VALUE } from "./auth/auth.types";

function mobileClient() {
  return { [MOBILE_CLIENT_HEADER]: MOBILE_CLIENT_VALUE };
}

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
  await prismaAdmin.friendInvitation.deleteMany();
  await prismaAdmin.friendship.deleteMany();
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

  it("returns access and refresh tokens for mobile clients on register and login", async () => {
    await sendRegistrationCodeForTest(app, "mobile@example.com");
    const code = getRegistrationCodeForTest("mobile@example.com");

    const registerResponse = await request(app)
      .post("/auth/register")
      .set(mobileClient())
      .send({
        email: "mobile@example.com",
        name: "Mobile User",
        password: "secure-password",
        code,
      });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.accessToken).toEqual(expect.any(String));
    expect(registerResponse.body.refreshToken).toEqual(expect.any(String));
    expect(registerResponse.body.user).toMatchObject({
      email: "mobile@example.com",
      name: "Mobile User",
    });
    expect(registerResponse.body.token).toBeUndefined();

    const loginResponse = await request(app)
      .post("/auth/login")
      .set(mobileClient())
      .send({ email: "mobile@example.com", password: "secure-password" });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.accessToken).toEqual(expect.any(String));
    expect(loginResponse.body.refreshToken).toEqual(expect.any(String));
  });

  it("refreshes mobile sessions using a refresh token in the request body", async () => {
    await sendRegistrationCodeForTest(app, "refresh-mobile@example.com");
    const code = getRegistrationCodeForTest("refresh-mobile@example.com");

    const registerResponse = await request(app)
      .post("/auth/register")
      .set(mobileClient())
      .send({
        email: "refresh-mobile@example.com",
        password: "secure-password",
        code,
      });

    const { accessToken, refreshToken } = registerResponse.body as {
      accessToken: string;
      refreshToken: string;
    };

    const meBeforeRefresh = await request(app)
      .get("/auth/me")
      .set(bearer(accessToken));
    expect(meBeforeRefresh.status).toBe(200);

    const refreshResponse = await request(app)
      .post("/auth/refresh")
      .set(mobileClient())
      .send({ refreshToken });

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.accessToken).toEqual(expect.any(String));
    expect(refreshResponse.body.refreshToken).toEqual(expect.any(String));
    expect(refreshResponse.body.accessToken).not.toBe(accessToken);
    expect(refreshResponse.body.refreshToken).not.toBe(refreshToken);

    const meAfterRefresh = await request(app)
      .get("/auth/me")
      .set(bearer(refreshResponse.body.accessToken));
    expect(meAfterRefresh.status).toBe(200);

    const oldTokenRejected = await request(app).get("/auth/me").set(bearer(accessToken));
    expect(oldTokenRejected.status).toBe(401);
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

  it("stores receipt metadata and line items with participant-based payloads", async () => {
    const first = await register("participant-first@example.com");
    const second = await register("participant-second@example.com");
    await becomeFriends(first, second);

    const created = await request(app).post("/bills").set(bearer(first.token)).send({
      description: "Receipt bill",
      incurredAt: "2026-05-25",
      totalCents: 1800,
      source: "capture",
      participantIds: [first.user.id, second.user.id],
      payerId: first.user.id,
      storeName: "Corner Store",
      subtotalCents: 1500,
      otherFeesCents: 100,
      taxCents: 150,
      tipCents: 150,
      lineItems: [
        {
          name: "Sandwich",
          quantity: 1,
          unitPriceCents: 1200,
          totalPriceCents: 1200,
          assignedUserIds: [first.user.id],
        },
        {
          name: "Juice",
          quantity: 1,
          unitPriceCents: 600,
          totalPriceCents: 600,
          assignedUserIds: [second.user.id],
        },
      ],
      shares: [
        { userId: first.user.id, shareCents: 1200 },
        { userId: second.user.id, shareCents: 600 },
      ],
    });

    const detail = await request(app)
      .get(`/bills/${created.body.bill.id as string}`)
      .set(bearer(first.token));

    expect(created.status).toBe(201);
    expect(created.body.bill.source).toBe("capture");
    expect(created.body.bill.otherFeesCents).toBe(100);
    expect(created.body.bill.isOneMainTotal).toBe(false);
    expect(created.body.bill.isSplitWithFriends).toBe(true);
    expect(created.body.bill.isSplitByFinalAmounts).toBe(false);
    expect(created.body.bill.lineItems).toHaveLength(2);
    expect(detail.status).toBe(200);
    expect(detail.body.bill.storeName).toBe("Corner Store");
    expect(detail.body.bill.lineItems[0].assignments).toHaveLength(1);
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

  it("creates a minimal manual bill with only description and total", async () => {
    const user = await register("minimal-manual@example.com");

    const created = await request(app).post("/bills").set(bearer(user.token)).send({
      description: "Quick lunch",
      totalCents: 2450,
    });

    expect(created.status).toBe(201);
    expect(created.body.bill.description).toBe("Quick lunch");
    expect(created.body.bill.totalCents).toBe(2450);
    expect(created.body.bill.source).toBe("manual");
    expect(created.body.bill.payer.id).toBe(user.user.id);
    expect(created.body.bill.shares).toHaveLength(1);
    expect(created.body.bill.shares[0].user.id).toBe(user.user.id);
    expect(created.body.bill.shares[0].shareCents).toBe(2450);
    expect(created.body.bill.isOneMainTotal).toBe(true);
    expect(created.body.bill.isSplitWithFriends).toBe(false);
    expect(created.body.bill.isSplitByFinalAmounts).toBe(true);
    expect(created.body.bill.lineItems).toHaveLength(0);
    expect(created.body.bill.userSummary.direction).toBe("none");
  });

  it("creates a manual bill with custom friend shares and no line items", async () => {
    const payer = await register("manual-split-payer@example.com");
    const friend = await register("manual-split-friend@example.com");
    await becomeFriends(payer, friend);

    const created = await request(app).post("/bills").set(bearer(payer.token)).send({
      description: "Shared taxi",
      totalCents: 3000,
      source: "manual",
      participantIds: [payer.user.id, friend.user.id],
      payerId: payer.user.id,
      shares: [
        { userId: payer.user.id, shareCents: 1000 },
        { userId: friend.user.id, shareCents: 2000 },
      ],
    });

    expect(created.status).toBe(201);
    expect(created.body.bill.lineItems).toHaveLength(0);
    expect(
      created.body.bill.shares
        .map((share: { shareCents: number }) => share.shareCents)
        .sort(),
    ).toEqual([1000, 2000]);
    expect(created.body.bill.isOneMainTotal).toBe(true);
    expect(created.body.bill.isSplitWithFriends).toBe(true);
    expect(created.body.bill.isSplitByFinalAmounts).toBe(true);
  });

  it("accepts line-item details split by final amounts and rejects invalid one-main-total assignment mode", async () => {
    const payer = await register("mode-payer@example.com");
    const friend = await register("mode-friend@example.com");
    await becomeFriends(payer, friend);

    const valid = await request(app).post("/bills").set(bearer(payer.token)).send({
      description: "Line items, final amounts",
      totalCents: 3000,
      source: "manual",
      participantIds: [payer.user.id, friend.user.id],
      payerId: payer.user.id,
      isOneMainTotal: false,
      isSplitWithFriends: true,
      isSplitByFinalAmounts: true,
      lineItems: [
        {
          name: "Item A",
          quantity: 1,
          unitPriceCents: 1000,
          totalPriceCents: 1000,
          assignedUserIds: [],
        },
        {
          name: "Item B",
          quantity: 1,
          unitPriceCents: 2000,
          totalPriceCents: 2000,
          assignedUserIds: [],
        },
      ],
      shares: [
        { userId: payer.user.id, shareCents: 1200 },
        { userId: friend.user.id, shareCents: 1800 },
      ],
    });

    const invalid = await request(app).post("/bills").set(bearer(payer.token)).send({
      description: "Invalid one-main-total assignment mode",
      totalCents: 1000,
      source: "manual",
      participantIds: [payer.user.id, friend.user.id],
      payerId: payer.user.id,
      isOneMainTotal: true,
      isSplitWithFriends: true,
      isSplitByFinalAmounts: false,
      lineItems: [
        {
          name: "Assigned line item",
          quantity: 1,
          unitPriceCents: 1000,
          totalPriceCents: 1000,
          assignedUserIds: [friend.user.id],
        },
      ],
    });

    expect(valid.status).toBe(201);
    expect(valid.body.bill.isOneMainTotal).toBe(false);
    expect(valid.body.bill.isSplitWithFriends).toBe(true);
    expect(valid.body.bill.isSplitByFinalAmounts).toBe(true);
    expect(valid.body.bill.lineItems).toHaveLength(2);

    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("INVALID_SPLIT_MODE");
  });

  it("lets a user dismiss activity from their feed", async () => {
    const payer = await register("payer-activity@example.com");
    const friend = await register("friend-activity@example.com");
    const friendshipId = await becomeFriends(payer, friend);

    await request(app).post("/bills").set(bearer(payer.token)).send({
      description: "Lunch",
      incurredAt: "2026-05-25",
      totalCents: 4000,
      targetType: "friendship",
      targetId: friendshipId,
      payerId: payer.user.id,
    });

    const before = await request(app).get("/activity").set(bearer(friend.token));
    const eventId = before.body.activity[0]?.id as string | undefined;

    expect(before.body.activity.length).toBeGreaterThan(0);
    expect(eventId).toBeTruthy();

    const deleted = await request(app)
      .delete(`/activity/${eventId}`)
      .set(bearer(friend.token));
    const after = await request(app).get("/activity").set(bearer(friend.token));

    expect(deleted.status).toBe(204);
    expect(after.body.activity.some((event: { id: string }) => event.id === eventId)).toBe(false);
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
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error.code).toBe("INVALID_SHARE_TOTAL");
    expect(payerExcluded.status).toBe(400);
    expect(payerExcluded.body.error.code).toBe("INVALID_SHARES");
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

    expect(friendshipBill.status).toBe(400);
    expect(friendshipBill.body.error.code).toBe("INVALID_PAYER");
  });
});

describe("bill settle API", () => {
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

  it("settles a friendship bill and clears dashboard balances", async () => {
    const payer = await register("settle-payer@example.com");
    const friend = await register("settle-friend@example.com");
    const friendshipId = await becomeFriends(payer, friend);

    const created = await request(app).post("/bills").set(bearer(payer.token)).send({
      description: "Dinner",
      incurredAt: "2026-05-25",
      totalCents: 1000,
      targetType: "friendship",
      targetId: friendshipId,
      payerId: payer.user.id,
    });

    const beforeSettle = await request(app).get("/dashboard").set(bearer(payer.token));
    const settled = await request(app)
      .post(`/bills/${created.body.bill.id as string}/settle`)
      .set(bearer(payer.token));
    const afterSettle = await request(app).get("/dashboard").set(bearer(payer.token));

    expect(beforeSettle.body.dashboard.totalOwedToYouCents).toBe(500);
    expect(settled.status).toBe(200);
    expect(settled.body.bill.userSummary).toMatchObject({
      direction: "owed_to_you",
      amountCents: 500,
      settled: true,
    });
    expect(afterSettle.body.dashboard.totalOwedToYouCents).toBe(0);
  });

  it("unsets settlement on a friendship bill", async () => {
    const payer = await register("unsettle-payer@example.com");
    const friend = await register("unsettle-friend@example.com");
    const friendshipId = await becomeFriends(payer, friend);

    const created = await request(app).post("/bills").set(bearer(payer.token)).send({
      description: "Brunch",
      incurredAt: "2026-05-25",
      totalCents: 1000,
      targetType: "friendship",
      targetId: friendshipId,
      payerId: payer.user.id,
    });

    const settled = await request(app)
      .post(`/bills/${created.body.bill.id as string}/settle`)
      .set(bearer(payer.token));
    const unsettled = await request(app)
      .post(`/bills/${created.body.bill.id as string}/unsettle`)
      .set(bearer(payer.token));
    const afterUnsettle = await request(app).get("/dashboard").set(bearer(payer.token));

    expect(settled.status).toBe(200);
    expect(unsettled.status).toBe(200);
    expect(unsettled.body.bill.userSummary).toMatchObject({
      direction: "owed_to_you",
      amountCents: 500,
      settled: false,
    });
    expect(afterUnsettle.body.dashboard.totalOwedToYouCents).toBe(500);
  });

  it("settles all outstanding bills with a friend", async () => {
    const you = await register("bulk-settle-you@example.com");
    const friend = await register("bulk-settle-friend@example.com");
    const friendshipId = await becomeFriends(you, friend);

    const lunchBill = await request(app).post("/bills").set(bearer(you.token)).send({
      description: "Lunch",
      incurredAt: "2026-05-25",
      totalCents: 2000,
      targetType: "friendship",
      targetId: friendshipId,
      payerId: you.user.id,
    });
    const taxiBill = await request(app).post("/bills").set(bearer(friend.token)).send({
      description: "Taxi",
      incurredAt: "2026-05-25",
      totalCents: 1000,
      targetType: "friendship",
      targetId: friendshipId,
      payerId: friend.user.id,
    });

    const beforeSettle = await request(app).get("/dashboard").set(bearer(you.token));
    const settled = await request(app)
      .post(`/friends/${friendshipId}/settle`)
      .set(bearer(you.token));
    const afterSettle = await request(app).get("/dashboard").set(bearer(you.token));
    const lunchAfterSettle = await request(app)
      .get(`/bills/${lunchBill.body.bill.id as string}`)
      .set(bearer(you.token));
    const taxiAfterSettle = await request(app)
      .get(`/bills/${taxiBill.body.bill.id as string}`)
      .set(bearer(you.token));
    const activity = await request(app).get("/activity").set(bearer(you.token));
    const friendSettledEvent = activity.body.activity.find(
      (event: { type: string }) => event.type === "FRIEND_SETTLED",
    );

    expect(beforeSettle.body.dashboard.balances[0].balanceCents).not.toBe(0);
    expect(settled.status).toBe(200);
    expect(settled.body.settledCount).toBeGreaterThan(0);
    expect(afterSettle.body.dashboard.balances[0].balanceCents).toBe(0);
    expect(
      lunchAfterSettle.body.bill.shares.find(
        (share: { user: { id: string } }) => share.user.id === friend.user.id,
      )?.settlementStatus,
    ).toBe("PAID");
    expect(
      taxiAfterSettle.body.bill.shares.find(
        (share: { user: { id: string } }) => share.user.id === you.user.id,
      )?.settlementStatus,
    ).toBe("PAID");
    expect(friendSettledEvent).toMatchObject({
      friendshipId,
      billId: null,
      friendInvitationId: null,
    });
  });

  it("settles one participant on a multi-person bill", async () => {
    const payer = await register("participant-settle-payer@example.com");
    const firstFriend = await register("participant-settle-first@example.com");
    const secondFriend = await register("participant-settle-second@example.com");
    await becomeFriends(payer, firstFriend);
    await becomeFriends(payer, secondFriend);

    const created = await request(app).post("/bills").set(bearer(payer.token)).send({
      description: "Trip groceries",
      incurredAt: "2026-05-25",
      totalCents: 3000,
      payerId: payer.user.id,
      participantIds: [payer.user.id, firstFriend.user.id, secondFriend.user.id],
    });

    const settledOne = await request(app)
      .post(`/bills/${created.body.bill.id as string}/settle`)
      .set(bearer(payer.token))
      .query({ participantUserId: firstFriend.user.id });
    const afterSettle = await request(app).get("/dashboard").set(bearer(payer.token));

    const firstShare = settledOne.body.bill.shares.find(
      (share: { user: { id: string } }) => share.user.id === firstFriend.user.id,
    );
    const secondShare = settledOne.body.bill.shares.find(
      (share: { user: { id: string } }) => share.user.id === secondFriend.user.id,
    );

    expect(settledOne.status).toBe(200);
    expect(settledOne.body.bill.userSummary).toMatchObject({
      direction: "owed_to_you",
      amountCents: 1000,
      settled: false,
    });
    expect(firstShare.settlementStatus).toBe("PAID");
    expect(secondShare.settlementStatus).toBe("NOT_PAID");
    expect(afterSettle.body.dashboard.totalOwedToYouCents).toBe(1000);
  });

  it("forbids non-payer from confirming another participant as paid", async () => {
    const payer = await register("participant-perm-payer@example.com");
    const firstFriend = await register("participant-perm-first@example.com");
    const secondFriend = await register("participant-perm-second@example.com");
    await becomeFriends(payer, firstFriend);
    await becomeFriends(payer, secondFriend);

    const created = await request(app).post("/bills").set(bearer(payer.token)).send({
      description: "Weekend fuel",
      incurredAt: "2026-05-25",
      totalCents: 3000,
      payerId: payer.user.id,
      participantIds: [payer.user.id, firstFriend.user.id, secondFriend.user.id],
    });

    const forbidden = await request(app)
      .post(`/bills/${created.body.bill.id as string}/settle`)
      .set(bearer(firstFriend.token))
      .query({ participantUserId: secondFriend.user.id });

    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("PARTICIPANT_SETTLE_FORBIDDEN");
  });

  it("returns NOTHING_TO_SETTLE when participant is already marked paid", async () => {
    const payer = await register("participant-already-paid-payer@example.com");
    const friend = await register("participant-already-paid-friend@example.com");
    await becomeFriends(payer, friend);

    const created = await request(app).post("/bills").set(bearer(payer.token)).send({
      description: "Coffee run",
      incurredAt: "2026-05-25",
      totalCents: 1000,
      payerId: payer.user.id,
      participantIds: [payer.user.id, friend.user.id],
    });

    const firstSettle = await request(app)
      .post(`/bills/${created.body.bill.id as string}/settle`)
      .set(bearer(payer.token))
      .query({ participantUserId: friend.user.id });
    const secondSettle = await request(app)
      .post(`/bills/${created.body.bill.id as string}/settle`)
      .set(bearer(payer.token))
      .query({ participantUserId: friend.user.id });

    expect(firstSettle.status).toBe(200);
    expect(secondSettle.status).toBe(400);
    expect(secondSettle.body.error.code).toBe("NOTHING_TO_SETTLE");
  });

  it("preserves settledAt when a bill is edited", async () => {
    const payer = await register("preserve-settle-payer@example.com");
    const friend = await register("preserve-settle-friend@example.com");
    const friendshipId = await becomeFriends(payer, friend);

    const created = await request(app).post("/bills").set(bearer(payer.token)).send({
      description: "Snacks",
      incurredAt: "2026-05-25",
      totalCents: 1000,
      targetType: "friendship",
      targetId: friendshipId,
      payerId: payer.user.id,
    });

    await request(app)
      .post(`/bills/${created.body.bill.id as string}/settle`)
      .set(bearer(payer.token));

    const updated = await request(app)
      .patch(`/bills/${created.body.bill.id as string}`)
      .set(bearer(payer.token))
      .send({
        description: "Snacks updated",
        incurredAt: "2026-05-25",
        totalCents: 1200,
        targetType: "friendship",
        targetId: friendshipId,
        payerId: payer.user.id,
      });

    const friendShare = updated.body.bill.shares.find(
      (share: { user: { id: string } }) => share.user.id === friend.user.id,
    );

    expect(updated.body.bill.description).toBe("Snacks updated");
    expect(friendShare.settledAt).not.toBeNull();
    expect(friendShare.settlementStatus).toBe("PAID");
    expect(updated.body.bill.userSummary.settled).toBe(true);
  });
});
