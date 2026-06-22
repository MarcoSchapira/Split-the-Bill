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

const nullableStringSchema = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value == null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

const nullableIntSchema = z
  .union([z.number().int(), z.null()])
  .optional()
  .transform((value) => value ?? null);

const billLineItemInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  quantity: z.number().positive().max(999_999),
  unitPriceCents: z.number().int().max(100_000_000),
  totalPriceCents: z.number().int().max(100_000_000),
  assignedUserIds: z.array(z.string().uuid()).min(1),
});

export const billInputSchema = z
  .object({
    description: z.string().trim().min(1).max(120),
    incurredAt: incurredAtSchema,
    totalCents: z.number().int().positive().max(100_000_000),
    payerId: z.string().uuid(),
    source: z.enum(["manual", "capture"]).optional().default("manual"),
    participantIds: z.array(z.string().uuid()).min(1).optional(),
    targetType: z.enum(["friendship"]).optional(),
    targetId: z.string().uuid().optional(),
    storeName: nullableStringSchema,
    storeAddress: nullableStringSchema,
    receiptNumber: nullableStringSchema,
    receiptDate: nullableStringSchema,
    receiptTime: nullableStringSchema,
    paymentMethod: nullableStringSchema,
    cardLast4: nullableStringSchema,
    itemCount: nullableIntSchema,
    subtotalCents: nullableIntSchema,
    otherFeesCents: nullableIntSchema,
    taxCents: nullableIntSchema,
    tipCents: nullableIntSchema,
    lineItems: z.array(billLineItemInputSchema).optional().default([]),
    shares: z.array(billShareInputSchema).min(1).optional(),
  })
  .refine(
    ({ participantIds, targetType, targetId }) => {
      const hasParticipantIds = Boolean(participantIds && participantIds.length > 0);
      const hasTarget = Boolean(targetType && targetId);
      return hasParticipantIds || hasTarget;
    },
    "Either participantIds or targetType/targetId must be supplied",
  )
  .refine(
    ({ targetType, targetId }) => Boolean(targetType) === Boolean(targetId),
    "targetType and targetId must be supplied together",
  )
  .strict();

export const billListQuerySchema = z
  .object({
    targetType: z.enum(["friendship"]).optional(),
    targetId: z.string().uuid().optional(),
    participantId: z.string().uuid().optional(),
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
