import { z } from "zod";

export const resolveTargetInputSchema = z
  .object({
    participantIds: z.array(z.string().uuid()).min(1),
    suggestedName: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export type ResolveTargetInput = z.infer<typeof resolveTargetInputSchema>;
