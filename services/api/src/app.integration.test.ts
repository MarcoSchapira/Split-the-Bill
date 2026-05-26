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

  it("allows members to view while only owners can add registered members", async () => {
    const owner = await register("owner@example.com");
    const member = await register("member@example.com");
    const nextMember = await register("next@example.com");
    const outsider = await register("outsider@example.com");
    const created = await request(app)
      .post("/groups")
      .set(bearer(owner.token))
      .send({ name: "Dinner Club" });
    const groupId = created.body.group.id as string;

    const addMember = await request(app)
      .post(`/groups/${groupId}/members`)
      .set(bearer(owner.token))
      .send({ email: " MEMBER@example.com " });
    const memberView = await request(app)
      .get(`/groups/${groupId}`)
      .set(bearer(member.token));
    const outsiderView = await request(app)
      .get(`/groups/${groupId}`)
      .set(bearer(outsider.token));
    const nonOwnerAdd = await request(app)
      .post(`/groups/${groupId}/members`)
      .set(bearer(member.token))
      .send({ email: nextMember.user.email });
    const missingUser = await request(app)
      .post(`/groups/${groupId}/members`)
      .set(bearer(owner.token))
      .send({ email: "missing@example.com" });
    const duplicate = await request(app)
      .post(`/groups/${groupId}/members`)
      .set(bearer(owner.token))
      .send({ email: member.user.email });

    expect(addMember.status).toBe(201);
    expect(addMember.body.member.role).toBe("member");
    expect(memberView.status).toBe(200);
    expect(memberView.body.group.members).toHaveLength(2);
    expect(outsiderView.status).toBe(403);
    expect(nonOwnerAdd.status).toBe(403);
    expect(missingUser.status).toBe(404);
    expect(duplicate.status).toBe(409);
  });
});
