import { z } from "zod";

export const registerSchema = z
  .object({
    email: z.string().trim().email().transform((email) => email.toLowerCase()),
    name: z.string().trim().min(1).max(100).optional(),
    password: z.string().min(8).max(100),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().email().transform((email) => email.toLowerCase()),
    password: z.string().min(1).max(100),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
};

export type AuthResponse = {
  token: string;
  user: AuthenticatedUser;
};

export const safeUserSelect = {
  id: true,
  email: true,
  name: true,
  createdAt: true,
} as const;
