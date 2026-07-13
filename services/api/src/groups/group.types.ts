import { z } from "zod";
import { groupIconKeySchema } from "./group-icons";

export const groupIdSchema = z.string().uuid();

export const createGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    iconKey: groupIconKeySchema,
  })
  .strict();

export const updateGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    iconKey: groupIconKeySchema.optional(),
  })
  .strict()
  .refine((value) => value.name !== undefined || value.iconKey !== undefined, {
    message: "At least one field must be provided",
  });

export const retroactiveScopeSchema = z.enum(["new_only", "unsettled_bills"]);

export const addGroupMemberSchema = z
  .object({
    userId: z.string().uuid(),
    retroactiveScope: retroactiveScopeSchema.optional().default("new_only"),
  })
  .strict();

export const membershipChangeSchema = z
  .object({
    retroactiveScope: retroactiveScopeSchema.optional().default("new_only"),
  })
  .strict();

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type RetroactiveScope = z.infer<typeof retroactiveScopeSchema>;
export type AddGroupMemberInput = z.infer<typeof addGroupMemberSchema>;
export type MembershipChangeInput = z.infer<typeof membershipChangeSchema>;
