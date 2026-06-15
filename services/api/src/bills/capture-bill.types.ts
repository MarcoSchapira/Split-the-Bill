import { z } from "zod";
import { parsedReceiptSchema } from "../receipts/receipt.types";

export const captureBillItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  totalPriceCents: z.number().int().nonnegative(),
  assignedUserIds: z.array(z.string().uuid()).min(1),
});

export const captureBillInputSchema = z
  .object({
    receipt: parsedReceiptSchema,
    payerId: z.string().uuid(),
    participantIds: z.array(z.string().uuid()).min(1),
    items: z.array(captureBillItemSchema).min(1),
  })
  .strict();

export type CaptureBillInput = z.infer<typeof captureBillInputSchema>;
export type CaptureBillItemInput = z.infer<typeof captureBillItemSchema>;
