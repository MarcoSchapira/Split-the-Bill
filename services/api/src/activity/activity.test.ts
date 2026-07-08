import { describe, expect, it } from "vitest";
import { formatActivityMessage } from "./activity.service";

const bill = {
  id: "bill-1",
  description: "Dinner",
  incurredAt: new Date("2026-05-25T00:00:00.000Z"),
  totalCents: 4250,
};

describe("formatActivityMessage", () => {
  it("builds bill labels from foreign-key bill data", () => {
    expect(formatActivityMessage("BILL_CREATED", bill, "fallback")).toBe(
      'added the bill "Dinner" on 2026-05-25 ($42.50).',
    );
    expect(formatActivityMessage("BILL_UNSETTLED", bill, "fallback")).toBe(
      'undid settlement on the bill "Dinner" on 2026-05-25 ($42.50).',
    );
  });

  it("disambiguates duplicate descriptions with date and amount", () => {
    const otherBill = {
      ...bill,
      id: "bill-2",
      incurredAt: new Date("2026-06-01T00:00:00.000Z"),
      totalCents: 1200,
    };

    expect(formatActivityMessage("BILL_CREATED", bill, "fallback")).not.toBe(
      formatActivityMessage("BILL_CREATED", otherBill, "fallback"),
    );
  });

  it("falls back to stored message when bill data is missing", () => {
    expect(formatActivityMessage("BILL_CREATED", null, 'added the bill "Dinner".')).toBe(
      'added the bill "Dinner".',
    );
  });
});
