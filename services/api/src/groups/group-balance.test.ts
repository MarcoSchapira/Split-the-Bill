import { describe, expect, it } from "vitest";
import { computeGroupNetBalanceCents } from "./group.service";

const bill = {
  payerId: "lender",
  totalCents: 1000,
  shares: [
    {
      userId: "lender",
      shareCents: 500,
      payerMarkedAsPaid: false,
      lenderConfirmedPaid: false,
    },
    {
      userId: "debtor",
      shareCents: 500,
      payerMarkedAsPaid: true,
      lenderConfirmedPaid: false,
    },
  ],
};

describe("group balances", () => {
  it("keeps marked-paid debt pending for the lender but removes it from the debtor's owing balance", () => {
    expect(computeGroupNetBalanceCents([bill], "lender")).toBe(500);
    expect(computeGroupNetBalanceCents([bill], "debtor")).toBe(0);
  });

  it("counts unpaid debt for the debtor", () => {
    const unpaid = {
      ...bill,
      shares: bill.shares.map((share) => ({ ...share, payerMarkedAsPaid: false })),
    };
    expect(computeGroupNetBalanceCents([unpaid], "debtor")).toBe(-500);
  });
});
