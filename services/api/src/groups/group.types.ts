import { z } from "zod";

export const groupIdSchema = z.string().uuid();

export const createGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
  })
  .strict();

export const addGroupMemberSchema = z
  .object({
    email: z.string().trim().email().transform((email) => email.toLowerCase()),
  })
  .strict();

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type AddGroupMemberInput = z.infer<typeof addGroupMemberSchema>;
