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
  await prismaAdmin.groupInvitation.deleteMany();
  await prismaAdmin.friendInvitation.deleteMany();
  await prismaAdmin.friendship.deleteMany();
  await prismaAdmin.groupMember.deleteMany();
  await prismaAdmin.group.deleteMany();
  await prismaAdmin.session.deleteMany();
  await prismaAdmin.user.deleteMany();
});

afterAll(async () => {
  await disconnectPrisma();
});

describe("cookie and CSRF authentication API", () => {
  it("sets auth cookies on register and does not return a token by default", async () => {
    const agent = request.agent(app);
    const response = await agent.post("/auth/register").send({
      email: "cookie-user@example.com",
      password: "secure-password",
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
      .post("/groups")
      .set(cookieHeader(cookies, [ACCESS_COOKIE, REFRESH_COOKIE]))
      .send({ name: "Blocked Group" });

    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("CSRF_VALIDATION_FAILED");
  });

  it("allows mutating requests with cookies and matching CSRF header", async () => {
    const agent = request.agent(app);
    const { cookies } = await registerWithCookies(agent, "cookie-create@example.com");

    const created = await agent
      .post("/groups")
      .set(csrfHeader(cookies))
      .send({ name: "Cookie Group" });

    expect(created.status).toBe(201);
    expect(created.body.group.name).toBe("Cookie Group");
  });

  it("clears the session after logout", async () => {
    const agent = request.agent(app);
    const { cookies } = await registerWithCookies(agent, "cookie-logout@example.com");

    const logout = await agent.post("/auth/logout").set(csrfHeader(cookies));
    expect(logout.status).toBe(204);

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
