import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "./app";
import { REFRESH_COOKIE } from "./auth/cookies";
import { disconnectPrisma, prismaAdmin } from "./db/prisma";
import {
  cookieHeader,
  csrfHeader,
  parseSetCookie,
  registerWithCookies,
  ACCESS_COOKIE,
  CSRF_COOKIE,
} from "./test/cookieAuth";
import { getRegistrationCodeForTest, registerTestUser, sendRegistrationCodeForTest } from "./test/registerHelper";

function expectAuthCookies(cookies: Record<string, string>) {
  expect(cookies[ACCESS_COOKIE]).toEqual(expect.any(String));
  expect(cookies[REFRESH_COOKIE]).toEqual(expect.any(String));
  expect(cookies[CSRF_COOKIE]).toEqual(expect.any(String));
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

describe("cookie and CSRF authentication API", () => {
  it("sets auth cookies on register and does not return a token by default", async () => {
    const agent = request.agent(app);
    await sendRegistrationCodeForTest(app, "cookie-user@example.com");
    const code = getRegistrationCodeForTest("cookie-user@example.com");

    const response = await agent.post("/auth/register").send({
      email: "cookie-user@example.com",
      password: "secure-password",
      code,
    });

    expect(response.status).toBe(201);
    expect(response.body.token).toBeUndefined();
    expectAuthCookies(parseSetCookie(response.headers["set-cookie"]));
  });

  it("authenticates GET /auth/me using cookies without Bearer", async () => {
    const agent = request.agent(app);
    await registerWithCookies(agent, "cookie-me@example.com");

    const me = await agent.get("/auth/me");

    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("cookie-me@example.com");
  });

  it("rejects mutating requests with cookies but no CSRF header", async () => {
    const agent = request.agent(app);
    const { cookies } = await registerWithCookies(agent, "cookie-csrf@example.com");

    const blocked = await request(app)
      .post("/friend-invitations")
      .set(cookieHeader(cookies, [ACCESS_COOKIE, REFRESH_COOKIE]))
      .send({ email: "friend@example.com" });

    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("CSRF_VALIDATION_FAILED");
  });

  it("allows mutating requests with cookies and matching CSRF header", async () => {
    const agent = request.agent(app);
    const { cookies } = await registerWithCookies(agent, "cookie-create@example.com");
    const friendResponse = await registerTestUser(app, "friend@example.com");
    expect(friendResponse.status).toBe(201);

    const created = await agent
      .post("/friend-invitations")
      .set(csrfHeader(cookies))
      .send({ email: "friend@example.com" });

    expect(created.status).toBe(201);
    expect(created.body.invitation.recipient.id).toBe(friendResponse.body.user.id);
  });

  it("clears the session after logout", async () => {
    const agent = request.agent(app);
    const { cookies } = await registerWithCookies(agent, "cookie-logout@example.com");

    const logout = await agent.post("/auth/logout").set(csrfHeader(cookies));
    expect(logout.status).toBe(204);

    const me = await agent.get("/auth/me");
    expect(me.status).toBe(401);
  });

  it("updates profile and clears cookies on logout-all", async () => {
    const agent = request.agent(app);
    const { cookies } = await registerWithCookies(agent, "cookie-settings@example.com");

    const updated = await agent
      .patch("/auth/me")
      .set(csrfHeader(cookies))
      .send({ name: "Updated Cookie User" });

    expect(updated.status).toBe(200);
    expect(updated.body.user.name).toBe("Updated Cookie User");

    const logoutAll = await agent.post("/auth/logout-all").set(csrfHeader(cookies));
    expect(logoutAll.status).toBe(204);

    const me = await agent.get("/auth/me");
    expect(me.status).toBe(401);
  });

  it("rotates refresh tokens and revokes all sessions on refresh reuse", async () => {
    const agent = request.agent(app);
    const { cookies } = await registerWithCookies(agent, "cookie-refresh@example.com");
    const oldRefresh = cookies[REFRESH_COOKIE];

    const refreshed = await agent.post("/auth/refresh").set(csrfHeader(cookies));
    expect(refreshed.status).toBe(204);

    const meAfterRefresh = await agent.get("/auth/me");
    expect(meAfterRefresh.status).toBe(200);

    const reuse = await request(app)
      .post("/auth/refresh")
      .set({
        Cookie: `${REFRESH_COOKIE}=${oldRefresh}`,
        ...csrfHeader(cookies),
      });

    expect(reuse.status).toBe(401);

    const meAfterReuse = await agent.get("/auth/me");
    expect(meAfterReuse.status).toBe(401);
  });
});
