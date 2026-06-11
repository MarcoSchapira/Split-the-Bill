import type { Express } from "express";
import type { Agent } from "supertest";
import { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE } from "../auth/cookies";

export function parseSetCookie(setCookie: string[] | string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  const headers = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];

  for (const header of headers) {
    const [pair] = header.split(";");
    const eqIndex = pair.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }
    const name = pair.slice(0, eqIndex).trim();
    const value = pair.slice(eqIndex + 1).trim();
    cookies[name] = value;
  }

  return cookies;
}

export function csrfHeader(cookies: Record<string, string>) {
  const csrf = cookies[CSRF_COOKIE];
  return csrf ? { "X-CSRF-Token": csrf } : {};
}

export function cookieHeader(cookies: Record<string, string>, names: string[]) {
  const parts = names
    .filter((name) => cookies[name])
    .map((name) => `${name}=${cookies[name]}`);

  return parts.length > 0 ? { Cookie: parts.join("; ") } : {};
}

export async function registerWithCookies(
  agent: Agent,
  email: string,
): Promise<{ user: { id: string; email: string }; cookies: Record<string, string> }> {
  const response = await agent.post("/auth/register").send({
    email,
    password: "secure-password",
  });

  const cookies = parseSetCookie(response.headers["set-cookie"]);

  return {
    user: response.body.user,
    cookies,
  };
}

export { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE };
