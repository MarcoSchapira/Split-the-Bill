import type { Request } from "express";
import { z } from "zod";

export const MOBILE_CLIENT_HEADER = "x-equisplit-client";
export const MOBILE_CLIENT_VALUE = "mobile";

export function isMobileClient(req: Request): boolean {
  return req.header(MOBILE_CLIENT_HEADER)?.toLowerCase() === MOBILE_CLIENT_VALUE;
}

export const mobileRefreshSchema = z
  .object({
    refreshToken: z.string().min(1),
  })
  .strict();

export const registerSchema = z
  .object({
    email: z.string().trim().email().transform((email) => email.toLowerCase()),
    name: z.string().trim().min(1).max(100).optional(),
    password: z.string().min(8).max(100),
    code: z.string().regex(/^\d{6}$/, "Verification code must be 6 digits"),
  })
  .strict();

export const sendRegistrationCodeSchema = z
  .object({
    email: z.string().trim().email().transform((email) => email.toLowerCase()),
  })
  .strict();

export const sendDeleteAccountCodeSchema = z
  .object({
    email: z.string().trim().email().transform((email) => email.toLowerCase()),
  })
  .strict();

export const verifyDeleteAccountCodeSchema = z
  .object({
    email: z.string().trim().email().transform((email) => email.toLowerCase()),
    code: z.string().regex(/^\d{6}$/, "Verification code must be 6 digits"),
  })
  .strict();

export const confirmDeleteAccountSchema = z
  .object({
    deletionToken: z.string().min(1),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().email().transform((email) => email.toLowerCase()),
    password: z.string().min(1).max(100),
  })
  .strict();

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(100),
    newPassword: z.string().min(8).max(100),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type SendRegistrationCodeInput = z.infer<typeof sendRegistrationCodeSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
};

export type AuthenticatedUser = PublicUser & {
  aiReceiptConsentAt: Date | null;
};

export type AuthResponse = {
  user: AuthenticatedUser;
  session: {
    accessToken: string;
    refreshToken: string;
  };
};

export type AuthResponseWithToken = AuthResponse & {
  token: string;
};

export function allowAuthTokenResponse(): boolean {
  return process.env.ALLOW_AUTH_TOKEN_RESPONSE === "true";
}

export type MobileAuthJson = {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
};

export type LegacyTokenAuthJson = {
  user: AuthenticatedUser;
  token: string;
};

/** User fields that are safe to embed in collaborator-facing resources. */
export const safeUserSelect = {
  id: true,
  email: true,
  name: true,
  createdAt: true,
} as const;

/** The private projection returned only by authenticated account endpoints. */
export const authenticatedUserSelect = {
  ...safeUserSelect,
  aiReceiptConsentAt: true,
} as const;
