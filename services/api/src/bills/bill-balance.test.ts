import { describe, expect, it } from "vitest";
import { sharesToSettle, userSummaryForBill } from "./bill-balance";

const shares = [
  { id: "share-a", userId: "user-a", shareCents: 500, settledAt: null },
  { id: "share-b", userId: "user-b", shareCents: 500, settledAt: null },
];

describe("userSummaryForBill", () => {
  it("shows amount owed to the payer on friendship bills", () => {
    expect(
      userSummaryForBill({ payerId: "user-a", shares }, "user-a", "user-b"),
    ).toMatchObject({
      amountCents: 500,
      direction: "owed_to_you",
      settled: false,
    });
  });

  it("marks settled friendship debt when the debtor share is settled", () => {
    const settledShares = [
      shares[0],
      { ...shares[1], settledAt: new Date("2026-05-25T00:00:00.000Z") },
    ];

    expect(
      userSummaryForBill({ payerId: "user-a", shares: settledShares }, "user-a", "user-b"),
    ).toMatchObject({
      amountCents: 500,
      direction: "owed_to_you",
      settled: true,
    });
  });

  it("returns debtor share ids for group payer settlement", () => {
    expect(
      sharesToSettle(
        {
          payerId: "user-a",
          shares: [
            { id: "share-a", userId: "user-a", shareCents: 1000, settledAt: null },
            { id: "share-b", userId: "user-b", shareCents: 1000, settledAt: null },
            { id: "share-c", userId: "user-c", shareCents: 1000, settledAt: null },
          ],
        },
        "user-a",
      ),
    ).toEqual(["share-b", "share-c"]);
  });
});
