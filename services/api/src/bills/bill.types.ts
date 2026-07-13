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
  assignedUserIds: z.array(z.string().uuid()).optional().default([]),
});

export const billInputSchema = z
  .object({
    description: z.string().trim().min(1).max(120),
    incurredAt: incurredAtSchema.optional(),
    totalCents: z.number().int().positive().max(100_000_000),
    payerId: z.string().uuid().optional(),
    source: z.enum(["manual", "capture"]).optional().default("manual"),
    isOneMainTotal: z.boolean().optional(),
    isSplitWithFriends: z.boolean().optional(),
    isSplitWithGroup: z.boolean().optional(),
    groupId: z.string().uuid().nullable().optional(),
    isSplitByFinalAmounts: z.boolean().optional(),
    participantIds: z.array(z.string().uuid()).min(1).optional(),
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
  .strict()
  .superRefine((value, ctx) => {
    const isSplitWithGroup = value.isSplitWithGroup ?? false;

    if (isSplitWithGroup && !value.groupId) {
      ctx.addIssue({
        code: "custom",
        message: "groupId is required when isSplitWithGroup is true",
        path: ["groupId"],
      });
    }

    if (!isSplitWithGroup && value.groupId) {
      ctx.addIssue({
        code: "custom",
        message: "groupId must be null when isSplitWithGroup is false",
        path: ["groupId"],
      });
    }
  });

export const billListQuerySchema = z.object({
  participantId: z.string().uuid().optional(),
  friendUserId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
});

export const billSettleQuerySchema = z
  .object({
    friendUserId: z.string().uuid().optional(),
    participantUserId: z.string().uuid().optional(),
  })
  .refine(
    ({ friendUserId, participantUserId }) => !(friendUserId && participantUserId),
    "friendUserId and participantUserId cannot be used together",
  );

export type BillInput = z.infer<typeof billInputSchema>;
export type BillListQuery = z.infer<typeof billListQuerySchema>;
export type BillSettleQuery = z.infer<typeof billSettleQuerySchema>;
