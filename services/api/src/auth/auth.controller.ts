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
import {
  allowAuthTokenResponse,
  changePasswordSchema,
  isMobileClient,
  loginSchema,
  mobileRefreshSchema,
  registerSchema,
  sendRegistrationCodeSchema,
  updateProfileSchema,
} from "./auth.types";
import {
  changeUserPassword,
  loginUser,
  registerUser,
  sendRegistrationVerificationCode,
  updateUserProfile,
} from "./auth.service";
import { verifyJwt } from "./jwt";
import {
  revokeAllSessions,
  revokeSession,
  revokeSessionByRefreshToken,
  rotateSession,
} from "./session.service";
import { ApiError } from "../http/errors";

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

function buildAuthJson(
  auth: Awaited<ReturnType<typeof loginUser>>,
  req: Parameters<RequestHandler>[0],
) {
  const body: {
    user: typeof auth.user;
    token?: string;
    accessToken?: string;
    refreshToken?: string;
  } = { user: auth.user };

  if (isMobileClient(req)) {
    body.accessToken = auth.session.accessToken;
    body.refreshToken = auth.session.refreshToken;
    return body;
  }

  if (allowAuthTokenResponse()) {
    body.token = auth.session.accessToken;
  }

  return body;
}

function resolveRefreshToken(
  req: Parameters<RequestHandler>[0],
): string | undefined {
  const cookieToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (cookieToken) {
    return cookieToken;
  }

  if (isMobileClient(req)) {
    const parsed = mobileRefreshSchema.safeParse(req.body);
    if (parsed.success) {
      return parsed.data.refreshToken;
    }
  }

  return undefined;
}

export const register: RequestHandler = async (req, res) => {
  const result = await registerUser(registerSchema.parse(req.body));
  attachAuthCookies(res, result);
  res.status(201).json(buildAuthJson(result, req));
};

export const sendRegistrationCode: RequestHandler = async (req, res) => {
  const input = sendRegistrationCodeSchema.parse(req.body);
  await sendRegistrationVerificationCode(input.email);
  res.status(204).send();
};

export const login: RequestHandler = async (req, res) => {
  const result = await loginUser(loginSchema.parse(req.body));
  attachAuthCookies(res, result);
  res.json(buildAuthJson(result, req));
};

export const refresh: RequestHandler = async (req, res) => {
  const refreshToken = resolveRefreshToken(req);

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

  if (isMobileClient(req)) {
    res.json({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    return;
  }

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
      const cookieRefreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
      if (cookieRefreshToken) {
        await revokeSessionByRefreshToken(cookieRefreshToken);
      }
    }
  }

  clearAuthCookies(res);
  res.status(204).send();
};

export const me: RequestHandler = (req, res) => {
  res.json({ user: currentUser(req) });
};

export const updateMe: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  const input = updateProfileSchema.parse(req.body);
  const updated = await updateUserProfile(user.id, input);
  res.json({ user: updated });
};

export const changePassword: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  if (!req.sessionId) {
    throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  }

  const input = changePasswordSchema.parse(req.body);
  await changeUserPassword(user.id, req.sessionId, input);
  res.status(204).send();
};

export const logoutAll: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  await revokeAllSessions(user.id);
  clearAuthCookies(res);
  res.status(204).send();
};
