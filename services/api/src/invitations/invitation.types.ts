import { z } from "zod";

export const invitationEmailSchema = z
  .object({
    email: z.string().trim().email().transform((email) => email.toLowerCase()),
  })
  .strict();

export const invitationIdSchema = z.string().uuid();

export const invitationDecisionSchema = z
  .object({
    decision: z.enum(["accept", "decline"]),
  })
  .strict();

export type InvitationEmailInput = z.infer<typeof invitationEmailSchema>;
export type InvitationDecisionInput = z.infer<typeof invitationDecisionSchema>;
