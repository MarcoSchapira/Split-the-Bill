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
import {
  DELETED_ACCOUNT_NAME,
  deletedAccountEmail,
} from "./auth/auth.service";
import { createSession } from "./auth/session.service";

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

function expectShareLenderIdsMatchPayer(bill: {
  payerId: string;
  shares: Array<{ lenderId: string }>;
}) {
  for (const share of bill.shares) {
    expect(share.lenderId).toBe(bill.payerId);
  }
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
  await prismaAdmin.groupMember.deleteMany();
  await prismaAdmin.group.deleteMany();
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

  it("updates the current user's display name", async () => {
    const account = await register("profile@example.com", "Old Name");

    const updated = await request(app)
      .patch("/auth/me")
      .set(bearer(account.token))
      .send({ name: "New Name" });

    expect(updated.status).toBe(200);
    expect(updated.body.user).toMatchObject({
      email: "profile@example.com",
      name: "New Name",
    });
    expect(updated.body.user).not.toHaveProperty("passwordHash");

    const me = await request(app).get("/auth/me").set(bearer(account.token));
    expect(me.body.user.name).toBe("New Name");

    const unauthenticated = await request(app).patch("/auth/me").send({ name: "Nope" });
    expect(unauthenticated.status).toBe(401);

    const invalid = await request(app)
      .patch("/auth/me")
      .set(bearer(account.token))
      .send({ name: "" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("changes password, keeps the current session, and revokes other sessions", async () => {
    await sendRegistrationCodeForTest(app, "pwd@example.com");
    const code = getRegistrationCodeForTest("pwd@example.com");

    const firstSession = await request(app)
      .post("/auth/register")
      .set(mobileClient())
      .send({
        email: "pwd@example.com",
        password: "secure-password",
        code,
      });

    expect(firstSession.status).toBe(201);

    const secondSession = await request(app)
      .post("/auth/login")
      .set(mobileClient())
      .send({ email: "pwd@example.com", password: "secure-password" });

    expect(secondSession.status).toBe(200);

    const wrongPassword = await request(app)
      .post("/auth/change-password")
      .set(bearer(firstSession.body.accessToken))
      .send({ currentPassword: "wrong-password", newPassword: "new-secure-password" });

    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe("INVALID_CREDENTIALS");

    const changed = await request(app)
      .post("/auth/change-password")
      .set(bearer(firstSession.body.accessToken))
      .send({
        currentPassword: "secure-password",
        newPassword: "new-secure-password",
      });

    expect(changed.status).toBe(204);

    const currentStillValid = await request(app)
      .get("/auth/me")
      .set(bearer(firstSession.body.accessToken));
    expect(currentStillValid.status).toBe(200);

    const otherSessionRejected = await request(app)
      .get("/auth/me")
      .set(bearer(secondSession.body.accessToken));
    expect(otherSessionRejected.status).toBe(401);

    const otherRefreshRejected = await request(app)
      .post("/auth/refresh")
      .set(mobileClient())
      .send({ refreshToken: secondSession.body.refreshToken });
    expect(otherRefreshRejected.status).toBe(401);

    const oldLogin = await request(app)
      .post("/auth/login")
      .set(mobileClient())
      .send({ email: "pwd@example.com", password: "secure-password" });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post("/auth/login")
      .set(mobileClient())
      .send({ email: "pwd@example.com", password: "new-secure-password" });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.accessToken).toEqual(expect.any(String));
  });

  it("rejects password change for accounts without a local password", async () => {
    await prismaAdmin.user.create({
      data: {
        email: "oauth-pwd@example.com",
        name: "OAuth User",
        authProvider: "google",
        providerUserId: "google-oauth-pwd",
        passwordHash: null,
        emailVerifiedAt: new Date(),
      },
    });

    // Create a session manually so requireAuth can succeed.
    const user = await prismaAdmin.user.findUniqueOrThrow({
      where: { email: "oauth-pwd@example.com" },
    });
    const session = await createSession(user.id);

    const response = await request(app)
      .post("/auth/change-password")
      .set(bearer(session.accessToken))
      .send({
        currentPassword: "anything",
        newPassword: "new-secure-password",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("PASSWORD_CHANGE_UNAVAILABLE");
  });

  it("revokes all sessions on logout-all", async () => {
    await sendRegistrationCodeForTest(app, "logout-all@example.com");
    const code = getRegistrationCodeForTest("logout-all@example.com");

    const session = await request(app)
      .post("/auth/register")
      .set(mobileClient())
      .send({
        email: "logout-all@example.com",
        password: "secure-password",
        code,
      });

    expect(session.status).toBe(201);

    const before = await request(app)
      .get("/auth/me")
      .set(bearer(session.body.accessToken));
    expect(before.status).toBe(200);

    const logoutAll = await request(app)
      .post("/auth/logout-all")
      .set(bearer(session.body.accessToken));
    expect(logoutAll.status).toBe(204);

    const after = await request(app)
      .get("/auth/me")
      .set(bearer(session.body.accessToken));
    expect(after.status).toBe(401);

    const refreshRejected = await request(app)
      .post("/auth/refresh")
      .set(mobileClient())
      .send({ refreshToken: session.body.refreshToken });
    expect(refreshRejected.status).toBe(401);
  });

  it("tombstones the account on delete, frees the email, and keeps shared bills", async () => {
    const first = await register("delete-me@example.com", "Delete Me");
    const second = await register("delete-friend@example.com", "Friend");

    const invitation = await request(app)
      .post("/friend-invitations")
      .set(bearer(first.token))
      .send({ email: second.user.email });
    await request(app)
      .patch(`/friend-invitations/${invitation.body.invitation.id as string}`)
      .set(bearer(second.token))
      .send({ decision: "accept" });

    const created = await request(app).post("/bills").set(bearer(first.token)).send({
      description: "Shared dinner",
      incurredAt: "2026-05-25",
      totalCents: 4000,
      participantIds: [first.user.id, second.user.id],
      payerId: first.user.id,
    });
    expect(created.status).toBe(201);
    const billId = created.body.bill.id as string;

    const deleted = await request(app)
      .delete("/auth/account")
      .set(bearer(first.token));
    expect(deleted.status).toBe(204);

    const meRejected = await request(app).get("/auth/me").set(bearer(first.token));
    expect(meRejected.status).toBe(401);

    const tombstone = await prismaAdmin.user.findUniqueOrThrow({
      where: { id: first.user.id },
    });
    expect(tombstone).toMatchObject({
      name: DELETED_ACCOUNT_NAME,
      email: deletedAccountEmail(first.user.id),
      passwordHash: null,
      providerUserId: null,
      emailVerifiedAt: null,
      authProvider: "deleted",
    });

    const activeSessions = await prismaAdmin.session.count({
      where: { userId: first.user.id, revokedAt: null },
    });
    expect(activeSessions).toBe(0);

    const friendships = await prismaAdmin.friendship.count({
      where: {
        OR: [{ userAId: first.user.id }, { userBId: first.user.id }],
      },
    });
    expect(friendships).toBe(0);

    const friendsForSecond = await request(app).get("/friends").set(bearer(second.token));
    expect(friendsForSecond.status).toBe(200);
    expect(friendsForSecond.body.friends).toHaveLength(0);

    const billForSecond = await request(app)
      .get(`/bills/${billId}`)
      .set(bearer(second.token));
    expect(billForSecond.status).toBe(200);
    expect(billForSecond.body.bill.payer).toMatchObject({
      id: first.user.id,
      name: DELETED_ACCOUNT_NAME,
    });
    const deletedShare = billForSecond.body.bill.shares.find(
      (share: { user: { id: string } }) => share.user.id === first.user.id,
    );
    expect(deletedShare?.user.name).toBe(DELETED_ACCOUNT_NAME);

    const reregister = await register("delete-me@example.com", "Back Again");
    expect(reregister.user.id).not.toBe(first.user.id);
    expect(reregister.user.email).toBe("delete-me@example.com");
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
        participantIds: [sender.user.id, recipient.user.id],
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

  it("rejects friend invitations to emails without an account", async () => {
    const sender = await register("inviter@example.com");

    const invitation = await request(app)
      .post("/friend-invitations")
      .set(bearer(sender.token))
      .send({ email: "future-friend@example.com" });

    expect(invitation.status).toBe(404);
    expect(invitation.body.error.code).toBe("USER_NOT_FOUND");
  });

  it("lets senders cancel pending invitations they sent", async () => {
    const sender = await register("sender-cancel@example.com");
    const recipient = await register("recipient-cancel@example.com");

    const invitation = await request(app)
      .post("/friend-invitations")
      .set(bearer(sender.token))
      .send({ email: recipient.user.email });
    const cancelled = await request(app)
      .delete(`/friend-invitations/${invitation.body.invitation.id as string}`)
      .set(bearer(sender.token));
    const senderInvites = await request(app).get("/invitations").set(bearer(sender.token));
    const recipientInvites = await request(app).get("/invitations").set(bearer(recipient.token));

    expect(invitation.status).toBe(201);
    expect(cancelled.status).toBe(204);
    expect(senderInvites.body.sentFriends).toHaveLength(0);
    expect(recipientInvites.body.receivedFriends).toHaveLength(0);
  });

  it("rejects cancel requests from non-senders", async () => {
    const sender = await register("sender-block-cancel@example.com");
    const recipient = await register("recipient-block-cancel@example.com");

    const invitation = await request(app)
      .post("/friend-invitations")
      .set(bearer(sender.token))
      .send({ email: recipient.user.email });
    const cancelled = await request(app)
      .delete(`/friend-invitations/${invitation.body.invitation.id as string}`)
      .set(bearer(recipient.token));

    expect(cancelled.status).toBe(404);
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
      participantIds: [first.user.id, second.user.id],
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
        participantIds: [first.user.id, second.user.id],
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

  it("lists bills shared with a specific friend via friendUserId", async () => {
    const first = await register("list-friend-first@example.com");
    const second = await register("list-friend-second@example.com");
    const third = await register("list-friend-third@example.com");
    await becomeFriends(first, second);
    await becomeFriends(first, third);

    await request(app).post("/bills").set(bearer(first.token)).send({
      description: "With second",
      incurredAt: "2026-05-25",
      totalCents: 1000,
      participantIds: [first.user.id, second.user.id],
      payerId: first.user.id,
    });
    await request(app).post("/bills").set(bearer(first.token)).send({
      description: "With third",
      incurredAt: "2026-05-25",
      totalCents: 2000,
      participantIds: [first.user.id, third.user.id],
      payerId: first.user.id,
    });

    const sharedWithSecond = await request(app)
      .get("/bills")
      .query({ friendUserId: second.user.id })
      .set(bearer(first.token));
    const sharedWithThird = await request(app)
      .get("/bills")
      .query({ friendUserId: third.user.id })
      .set(bearer(first.token));

    expect(sharedWithSecond.status).toBe(200);
    expect(sharedWithSecond.body.bills).toHaveLength(1);
    expect(sharedWithSecond.body.bills[0].description).toBe("With second");
    expect(sharedWithThird.status).toBe(200);
    expect(sharedWithThird.body.bills).toHaveLength(1);
    expect(sharedWithThird.body.bills[0].description).toBe("With third");
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
      participantIds: [payer.user.id, friend.user.id],
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
    expectShareLenderIdsMatchPayer(created.body.bill);
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
    expectShareLenderIdsMatchPayer(created.body.bill);
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
      participantIds: [payer.user.id, friend.user.id],
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
      participantIds: [first.user.id, second.user.id],
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
      participantIds: [first.user.id, second.user.id],
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
      participantIds: [first.user.id, second.user.id],
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
      participantIds: [payer.user.id, friend.user.id],
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
      participantIds: [payer.user.id, friend.user.id],
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
      participantIds: [you.user.id, friend.user.id],
      payerId: you.user.id,
    });
    const taxiBill = await request(app).post("/bills").set(bearer(friend.token)).send({
      description: "Taxi",
      incurredAt: "2026-05-25",
      totalCents: 1000,
      participantIds: [friend.user.id, you.user.id],
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
    expect(afterSettle.body.dashboard.balances[0].balanceCents).toBe(-500);
    expect(
      lunchAfterSettle.body.bill.shares.find(
        (share: { user: { id: string } }) => share.user.id === friend.user.id,
      )?.lenderConfirmedPaid,
    ).toBe(true);
    expect(
      taxiAfterSettle.body.bill.shares.find(
        (share: { user: { id: string } }) => share.user.id === you.user.id,
      )?.payerMarkedAsPaid,
    ).toBe(true);
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
    expect(firstShare.lenderConfirmedPaid).toBe(true);
    expect(secondShare.lenderConfirmedPaid).toBe(false);
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

  it("preserves settlement flags when a bill is edited", async () => {
    const payer = await register("preserve-settle-payer@example.com");
    const friend = await register("preserve-settle-friend@example.com");
    const friendshipId = await becomeFriends(payer, friend);

    const created = await request(app).post("/bills").set(bearer(payer.token)).send({
      description: "Snacks",
      incurredAt: "2026-05-25",
      totalCents: 1000,
      participantIds: [payer.user.id, friend.user.id],
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
        participantIds: [payer.user.id, friend.user.id],
        payerId: payer.user.id,
      });

    const friendShare = updated.body.bill.shares.find(
      (share: { user: { id: string } }) => share.user.id === friend.user.id,
    );

    expect(updated.body.bill.description).toBe("Snacks updated");
    expect(friendShare.lenderConfirmedPaid).toBe(true);
    expect(updated.body.bill.userSummary.settled).toBe(true);
  });

  it("settles immediately when lender confirms without debtor marking", async () => {
    const payer = await register("lender-confirm-payer@example.com");
    const friend = await register("lender-confirm-friend@example.com");
    await becomeFriends(payer, friend);

    const created = await request(app).post("/bills").set(bearer(payer.token)).send({
      description: "Dinner",
      incurredAt: "2026-05-25",
      totalCents: 2000,
      participantIds: [payer.user.id, friend.user.id],
      payerId: payer.user.id,
    });

    const beforeSettle = await request(app).get("/dashboard").set(bearer(payer.token));
    const settled = await request(app)
      .post(`/bills/${created.body.bill.id as string}/settle`)
      .set(bearer(payer.token));
    const afterSettle = await request(app).get("/dashboard").set(bearer(payer.token));

    const friendShare = settled.body.bill.shares.find(
      (share: { user: { id: string } }) => share.user.id === friend.user.id,
    );

    expect(settled.status).toBe(200);
    expect(friendShare.lenderConfirmedPaid).toBe(true);
    expect(friendShare.payerMarkedAsPaid).toBe(false);
    expect(settled.body.bill.userSummary.settled).toBe(true);
    expect(beforeSettle.body.dashboard.totalOwedToYouCents).toBe(1000);
    expect(afterSettle.body.dashboard.totalOwedToYouCents).toBe(0);
  });

  it("keeps balance outstanding when debtor marks before lender confirms", async () => {
    const payer = await register("debtor-mark-payer@example.com");
    const friend = await register("debtor-mark-friend@example.com");
    await becomeFriends(payer, friend);

    const created = await request(app).post("/bills").set(bearer(payer.token)).send({
      description: "Brunch",
      incurredAt: "2026-05-25",
      totalCents: 2000,
      participantIds: [payer.user.id, friend.user.id],
      payerId: payer.user.id,
    });

    const debtorMarked = await request(app)
      .post(`/bills/${created.body.bill.id as string}/settle`)
      .set(bearer(friend.token));
    const afterDebtorMarkPayer = await request(app).get("/dashboard").set(bearer(payer.token));
    const afterDebtorMarkFriend = await request(app).get("/dashboard").set(bearer(friend.token));

    const friendShare = debtorMarked.body.bill.shares.find(
      (share: { user: { id: string } }) => share.user.id === friend.user.id,
    );

    expect(debtorMarked.status).toBe(200);
    expect(friendShare.payerMarkedAsPaid).toBe(true);
    expect(friendShare.lenderConfirmedPaid).toBe(false);
    expect(debtorMarked.body.bill.userSummary.settled).toBe(false);
    expect(afterDebtorMarkPayer.body.dashboard.totalOwedToYouCents).toBe(1000);
    expect(afterDebtorMarkPayer.body.dashboard.owedToYouPendingConfirmationPercent).toBe(100);
    expect(afterDebtorMarkFriend.body.dashboard.totalYouOweCents).toBe(0);
    expect(afterDebtorMarkFriend.body.dashboard.youOwePendingConfirmationPercent).toBe(100);
  });

  it("computes pending confirmation percent from mixed payer-marked shares", async () => {
    const payer = await register("mixed-pending-payer@example.com");
    const friendA = await register("mixed-pending-friend-a@example.com");
    const friendB = await register("mixed-pending-friend-b@example.com");
    await becomeFriends(payer, friendA);
    await becomeFriends(payer, friendB);

    const billA = await request(app).post("/bills").set(bearer(payer.token)).send({
      description: "Lunch A",
      incurredAt: "2026-05-25",
      totalCents: 2000,
      participantIds: [payer.user.id, friendA.user.id],
      payerId: payer.user.id,
    });
    const billB = await request(app).post("/bills").set(bearer(payer.token)).send({
      description: "Lunch B",
      incurredAt: "2026-05-25",
      totalCents: 2000,
      participantIds: [payer.user.id, friendB.user.id],
      payerId: payer.user.id,
    });

    await request(app)
      .post(`/bills/${billA.body.bill.id as string}/settle`)
      .set(bearer(friendA.token));

    const dashboard = await request(app).get("/dashboard").set(bearer(payer.token));

    expect(dashboard.status).toBe(200);
    expect(dashboard.body.dashboard.totalOwedToYouCents).toBe(2000);
    expect(dashboard.body.dashboard.owedToYouPendingConfirmationPercent).toBe(50);
  });
});

describe("groups API", () => {
  async function becomeFriends(first: RegisteredAccount, second: RegisteredAccount) {
    const invite = await request(app)
      .post("/friend-invitations")
      .set(bearer(first.token))
      .send({ email: second.user.email });
    const accept = await request(app)
      .patch(`/friend-invitations/${invite.body.invitation.id as string}`)
      .set(bearer(second.token))
      .send({ decision: "accept" });

    expect(accept.status).toBe(200);
    return accept.body.invitation.friendshipId as string;
  }

  it("creates, lists, and returns group detail", async () => {
    const owner = await register("group-owner@example.com");

    const created = await request(app).post("/groups").set(bearer(owner.token)).send({
      name: "Roommates",
      iconKey: "home",
    });

    expect(created.status).toBe(201);
    expect(created.body.group).toMatchObject({
      name: "Roommates",
      iconKey: "home",
      memberCount: 1,
    });

    const listed = await request(app).get("/groups").set(bearer(owner.token));
    expect(listed.body.groups).toHaveLength(1);

    const detail = await request(app)
      .get(`/groups/${created.body.group.id as string}`)
      .set(bearer(owner.token));

    expect(detail.status).toBe(200);
    expect(detail.body.group.members).toHaveLength(1);
    expect(detail.body.group.hasExistingBills).toBe(false);
  });

  it("creates group bills with even shares for all members", async () => {
    const owner = await register("group-bill-owner@example.com");
    const friend = await register("group-bill-friend@example.com");
    await becomeFriends(owner, friend);

    const group = await request(app).post("/groups").set(bearer(owner.token)).send({
      name: "Trip",
      iconKey: "trip",
    });

    await request(app)
      .post(`/groups/${group.body.group.id as string}/members`)
      .set(bearer(owner.token))
      .send({ userId: friend.user.id });

    const bill = await request(app).post("/bills").set(bearer(owner.token)).send({
      description: "Dinner",
      incurredAt: "2026-05-25",
      totalCents: 2000,
      payerId: owner.user.id,
      isSplitWithGroup: true,
      groupId: group.body.group.id,
    });

    expect(bill.status).toBe(201);
    expect(bill.body.bill.isSplitWithGroup).toBe(true);
    expect(bill.body.bill.shares).toHaveLength(2);
    expect(bill.body.bill.shares.map((share: { shareCents: number }) => share.shareCents)).toEqual([
      1000, 1000,
    ]);
    expectShareLenderIdsMatchPayer(bill.body.bill);
  });

  it("does not add a new member to existing group bills", async () => {
    const owner = await register("group-retro-owner@example.com");
    const friend = await register("group-retro-friend@example.com");
    const third = await register("group-retro-third@example.com");
    await becomeFriends(owner, friend);
    await becomeFriends(owner, third);

    const group = await request(app).post("/groups").set(bearer(owner.token)).send({
      name: "House",
      iconKey: "rent",
    });

    await request(app)
      .post(`/groups/${group.body.group.id as string}/members`)
      .set(bearer(owner.token))
      .send({ userId: friend.user.id });

    const bill = await request(app).post("/bills").set(bearer(owner.token)).send({
      description: "Utilities",
      incurredAt: "2026-05-25",
      totalCents: 3000,
      payerId: owner.user.id,
      isSplitWithGroup: true,
      groupId: group.body.group.id,
    });

    const added = await request(app)
      .post(`/groups/${group.body.group.id as string}/members`)
      .set(bearer(owner.token))
      .send({ userId: third.user.id });

    expect(added.status).toBe(200);
    expect(added.body.group.members).toHaveLength(3);

    const updatedBill = await request(app)
      .get(`/bills/${bill.body.bill.id as string}`)
      .set(bearer(owner.token));

    expect(updatedBill.body.bill.shares).toHaveLength(2);
    expect(
      updatedBill.body.bill.shares.map((share: { user: { id: string } }) => share.user.id).sort(),
    ).toEqual([owner.user.id, friend.user.id].sort());
    expectShareLenderIdsMatchPayer(updatedBill.body.bill);
  });

  it("does not remove a member from existing group bills when removed from the group", async () => {
    const owner = await register("group-remove-owner@example.com");
    const friend = await register("group-remove-friend@example.com");
    await becomeFriends(owner, friend);

    const group = await request(app).post("/groups").set(bearer(owner.token)).send({
      name: "House",
      iconKey: "rent",
    });

    await request(app)
      .post(`/groups/${group.body.group.id as string}/members`)
      .set(bearer(owner.token))
      .send({ userId: friend.user.id });

    const bill = await request(app).post("/bills").set(bearer(owner.token)).send({
      description: "Utilities",
      incurredAt: "2026-05-25",
      totalCents: 2000,
      payerId: owner.user.id,
      isSplitWithGroup: true,
      groupId: group.body.group.id,
    });

    const removed = await request(app)
      .delete(`/groups/${group.body.group.id as string}/members/${friend.user.id}`)
      .set(bearer(owner.token));

    expect(removed.status).toBe(200);
    expect(removed.body.group.members.map((member: { user: { id: string } }) => member.user.id)).toEqual([
      owner.user.id,
    ]);

    const updatedBill = await request(app)
      .get(`/bills/${bill.body.bill.id as string}`)
      .set(bearer(owner.token));

    expect(
      updatedBill.body.bill.shares.map((share: { user: { id: string } }) => share.user.id).sort(),
    ).toEqual([owner.user.id, friend.user.id].sort());
    expectShareLenderIdsMatchPayer(updatedBill.body.bill);
  });

  it("clears line-item assignments when switching a bill to group split", async () => {
    const owner = await register("group-switch-owner@example.com");
    const friend = await register("group-switch-friend@example.com");
    await becomeFriends(owner, friend);

    const group = await request(app).post("/groups").set(bearer(owner.token)).send({
      name: "Foodies",
      iconKey: "food",
    });

    await request(app)
      .post(`/groups/${group.body.group.id as string}/members`)
      .set(bearer(owner.token))
      .send({ userId: friend.user.id });

    const created = await request(app).post("/bills").set(bearer(owner.token)).send({
      description: "Lunch",
      incurredAt: "2026-05-25",
      totalCents: 2000,
      payerId: owner.user.id,
      participantIds: [owner.user.id, friend.user.id],
      isSplitByFinalAmounts: false,
      lineItems: [
        {
          name: "Burger",
          quantity: 1,
          unitPriceCents: 1200,
          totalPriceCents: 1200,
          assignedUserIds: [owner.user.id],
        },
        {
          name: "Salad",
          quantity: 1,
          unitPriceCents: 800,
          totalPriceCents: 800,
          assignedUserIds: [friend.user.id],
        },
      ],
    });

    const updated = await request(app)
      .patch(`/bills/${created.body.bill.id as string}`)
      .set(bearer(owner.token))
      .send({
        description: "Lunch",
        incurredAt: "2026-05-25",
        totalCents: 2000,
        payerId: owner.user.id,
        isSplitWithGroup: true,
        groupId: group.body.group.id,
        lineItems: created.body.bill.lineItems.map(
          (item: { name: string; quantity: number; unitPriceCents: number; totalPriceCents: number }) => ({
            ...item,
            assignedUserIds: [owner.user.id],
          }),
        ),
      });

    expect(updated.status).toBe(200);
    expect(updated.body.bill.isSplitWithGroup).toBe(true);
    expect(updated.body.bill.lineItems.every(
      (item: { assignments: unknown[] }) => item.assignments.length === 0,
    )).toBe(true);
    expect(updated.body.bill.shares.map((share: { shareCents: number }) => share.shareCents)).toEqual([
      1000, 1000,
    ]);
    expectShareLenderIdsMatchPayer(updated.body.bill);
  });

  it("forbids non-creator from removing members but allows any member to edit", async () => {
    const owner = await register("group-perm-owner@example.com");
    const friend = await register("group-perm-friend@example.com");
    await becomeFriends(owner, friend);

    const group = await request(app).post("/groups").set(bearer(owner.token)).send({
      name: "Work",
      iconKey: "work",
    });

    await request(app)
      .post(`/groups/${group.body.group.id as string}/members`)
      .set(bearer(owner.token))
      .send({ userId: friend.user.id });

    const renamed = await request(app)
      .patch(`/groups/${group.body.group.id as string}`)
      .set(bearer(friend.token))
      .send({ name: "Office" });

    const forbidden = await request(app)
      .delete(`/groups/${group.body.group.id as string}/members/${owner.user.id}`)
      .set(bearer(friend.token));

    expect(renamed.status).toBe(200);
    expect(renamed.body.group.name).toBe("Office");
    expect(forbidden.status).toBe(403);
  });

  it("lets a member leave while keeping shares on existing group bills", async () => {
    const owner = await register("group-leave-owner@example.com");
    const friend = await register("group-leave-friend@example.com");
    await becomeFriends(owner, friend);

    const group = await request(app).post("/groups").set(bearer(owner.token)).send({
      name: "Test1",
      iconKey: "trip",
    });

    await request(app)
      .post(`/groups/${group.body.group.id as string}/members`)
      .set(bearer(owner.token))
      .send({ userId: friend.user.id });

    const bill = await request(app).post("/bills").set(bearer(owner.token)).send({
      description: "Dinner",
      incurredAt: "2026-05-25",
      totalCents: 2000,
      payerId: owner.user.id,
      isSplitWithGroup: true,
      groupId: group.body.group.id,
    });

    const left = await request(app)
      .post(`/groups/${group.body.group.id as string}/leave`)
      .set(bearer(friend.token));

    expect(left.status).toBe(204);

    const detail = await request(app)
      .get(`/groups/${group.body.group.id as string}`)
      .set(bearer(owner.token));

    expect(detail.status).toBe(200);
    expect(detail.body.group.members.map((member: { user: { id: string } }) => member.user.id)).toEqual([
      owner.user.id,
    ]);

    const updatedBill = await request(app)
      .get(`/bills/${bill.body.bill.id as string}`)
      .set(bearer(owner.token));

    expect(updatedBill.body.bill.shares.map((share: { user: { id: string } }) => share.user.id).sort()).toEqual(
      [owner.user.id, friend.user.id].sort(),
    );
  });

  it("filters bills by groupId", async () => {
    const owner = await register("group-filter-owner@example.com");
    const friend = await register("group-filter-friend@example.com");
    await becomeFriends(owner, friend);

    const group = await request(app).post("/groups").set(bearer(owner.token)).send({
      name: "Groceries",
      iconKey: "groceries",
    });

    await request(app)
      .post(`/groups/${group.body.group.id as string}/members`)
      .set(bearer(owner.token))
      .send({ userId: friend.user.id });

    await request(app).post("/bills").set(bearer(owner.token)).send({
      description: "Market",
      incurredAt: "2026-05-25",
      totalCents: 4000,
      payerId: owner.user.id,
      isSplitWithGroup: true,
      groupId: group.body.group.id,
    });

    await request(app).post("/bills").set(bearer(owner.token)).send({
      description: "Direct lunch",
      incurredAt: "2026-05-25",
      totalCents: 2000,
      payerId: owner.user.id,
      participantIds: [owner.user.id, friend.user.id],
    });

    const groupBills = await request(app)
      .get("/bills")
      .set(bearer(owner.token))
      .query({ groupId: group.body.group.id });

    expect(groupBills.body.bills).toHaveLength(1);
    expect(groupBills.body.bills[0].description).toBe("Market");
  });
});
