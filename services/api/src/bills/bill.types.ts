import { z } from "zod";

const incurredAtSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid incurred date")
  .transform((value) => new Date(value));

export const billIdSchema = z.string().uuid();

export const billShareInputSchema = z.object({
  userId: z.string().uuid(),
  shareCents: z.number().int().nonnegative(),
});

export const billInputSchema = z
  .object({
    description: z.string().trim().min(1).max(120),
    incurredAt: incurredAtSchema,
    totalCents: z.number().int().positive().max(100_000_000),
    targetType: z.enum(["friendship", "group"]),
    targetId: z.string().uuid(),
    payerId: z.string().uuid(),
    source: z.enum(["manual", "capture"]).optional().default("manual"),
    shares: z.array(billShareInputSchema).min(1).optional(),
  })
  .strict();

export const billListQuerySchema = z
  .object({
    targetType: z.enum(["friendship", "group"]).optional(),
    targetId: z.string().uuid().optional(),
  })
  .refine(
    ({ targetId, targetType }) => Boolean(targetId) === Boolean(targetType),
    "targetType and targetId must be supplied together",
  );

export const billSettleQuerySchema = z.object({
  friendUserId: z.string().uuid().optional(),
});

export type BillInput = z.infer<typeof billInputSchema>;
export type BillListQuery = z.infer<typeof billListQuerySchema>;
export type BillSettleQuery = z.infer<typeof billSettleQuerySchema>;
