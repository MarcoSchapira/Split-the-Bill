import type { RequestHandler } from "express";
import { currentUser } from "./currentUser";
import {
  accessTokenMaxAgeMs,
  clearAuthCookies,
  generateCsrfToken,
  refreshTokenMaxAgeMs,
  setAuthCookies,
  REFRESH_COOKIE,
  ACCESS_COOKIE,
} from "./cookies";
import { allowAuthTokenResponse, loginSchema, registerSchema } from "./auth.types";
import { loginUser, registerUser } from "./auth.service";
import { verifyJwt } from "./jwt";
import { revokeSession, revokeSessionByRefreshToken, rotateSession } from "./session.service";

function attachAuthCookies(
  res: Parameters<RequestHandler>[1],
  auth: Awaited<ReturnType<typeof loginUser>>,
): void {
  const csrfToken = generateCsrfToken();
  setAuthCookies(
    res,
    auth.session.accessToken,
    auth.session.refreshToken,
    accessTokenMaxAgeMs(),
    refreshTokenMaxAgeMs(),
    csrfToken,
  );
}

function buildAuthJson(auth: Awaited<ReturnType<typeof loginUser>>) {
  const body: { user: typeof auth.user; token?: string } = { user: auth.user };
  if (allowAuthTokenResponse()) {
    body.token = auth.session.accessToken;
  }
  return body;
}

export const register: RequestHandler = async (req, res) => {
  const result = await registerUser(registerSchema.parse(req.body));
  attachAuthCookies(res, result);
  res.status(201).json(buildAuthJson(result));
};

export const login: RequestHandler = async (req, res) => {
  const result = await loginUser(loginSchema.parse(req.body));
  attachAuthCookies(res, result);
  res.json(buildAuthJson(result));
};

export const refresh: RequestHandler = async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;

  if (!refreshToken) {
    clearAuthCookies(res);
    res.status(401).json({
      error: { code: "INVALID_REFRESH_TOKEN", message: "Invalid or expired refresh token" },
    });
    return;
  }

  const session = await rotateSession(refreshToken);
  const csrfToken = generateCsrfToken();
  setAuthCookies(
    res,
    session.accessToken,
    session.refreshToken,
    accessTokenMaxAgeMs(),
    refreshTokenMaxAgeMs(),
    csrfToken,
  );

  if (allowAuthTokenResponse()) {
    res.json({ token: session.accessToken });
    return;
  }

  res.status(204).send();
};

export const logout: RequestHandler = async (req, res) => {
  const bearerMatch = req.header("authorization")?.match(/^Bearer\s+(.+)$/i);

  if (bearerMatch) {
    try {
      const payload = verifyJwt(bearerMatch[1]);
      await revokeSession(payload.sessionId, payload.userId);
    } catch {
      // Ignore invalid bearer tokens during logout.
    }
  } else if (req.sessionId && req.user) {
    await revokeSession(req.sessionId, req.user.id);
  } else {
    const accessToken = req.cookies?.[ACCESS_COOKIE] as string | undefined;

    if (accessToken) {
      try {
        const payload = verifyJwt(accessToken);
        await revokeSession(payload.sessionId, payload.userId);
      } catch {
        // Ignore invalid access tokens during logout.
      }
    } else {
      const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
      if (refreshToken) {
        await revokeSessionByRefreshToken(refreshToken);
      }
    }
  }

  clearAuthCookies(res);
  res.status(204).send();
};

export const me: RequestHandler = (req, res) => {
  res.json({ user: currentUser(req) });
};
