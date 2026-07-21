import { describe, expect, it } from "vitest";
import { billInputSchema } from "./bill.types";

const validBill = {
  description: "Dinner",
  totalCents: 2_500,
  participantIds: ["00000000-0000-4000-8000-000000000001"],
};

describe("billInputSchema", () => {
  it.each([
    ["subtotalCents", -1],
    ["otherFeesCents", -1],
    ["taxCents", -1],
    ["tipCents", -1],
    ["itemCount", -1],
  ])("rejects a negative %s", (field, value) => {
    expect(() => billInputSchema.parse({ ...validBill, [field]: value })).toThrow();
  });

  it("rejects negative line-item prices", () => {
    expect(() => billInputSchema.parse({
      ...validBill,
      isOneMainTotal: false,
      lineItems: [{
        name: "Soup",
        quantity: 1,
        unitPriceCents: -100,
        totalPriceCents: -100,
        assignedUserIds: [],
      }],
    })).toThrow();
  });

  it("coerces Decimal-like quantity strings from clients", () => {
    const parsed = billInputSchema.parse({
      ...validBill,
      isOneMainTotal: false,
      lineItems: [{
        name: "Soup",
        quantity: "2.000",
        unitPriceCents: 500,
        totalPriceCents: 1000,
        assignedUserIds: [],
      }],
    });
    expect(parsed.lineItems[0]?.quantity).toBe(2);
  });
});
