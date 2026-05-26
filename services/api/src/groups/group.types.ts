import { z } from "zod";

export const groupIdSchema = z.string().uuid();

export const createGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
  })
  .strict();

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
