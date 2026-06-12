import request from "supertest";
import type { Express } from "express";
import { expect } from "vitest";
import { getTestRegistrationCode } from "../email/email.transport";

export async function sendRegistrationCodeForTest(app: Express, email: string): Promise<void> {
  const response = await request(app).post("/auth/register/send-code").send({ email });

  expect(response.status).toBe(204);
}

export function getRegistrationCodeForTest(email: string): string {
  const code = getTestRegistrationCode(email.toLowerCase());

  if (!code) {
    throw new Error(`No verification code found for ${email}`);
  }

  return code;
}

export async function registerTestUser(
  app: Express,
  email: string,
  options?: { name?: string; password?: string },
): Promise<request.Response> {
  await sendRegistrationCodeForTest(app, email);

  const code = getRegistrationCodeForTest(email);

  return request(app)
    .post("/auth/register")
    .send({
      email,
      code,
      password: options?.password ?? "secure-password",
      ...(options?.name ? { name: options.name } : {}),
    });
}
