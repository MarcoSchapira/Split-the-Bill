import { describe, expect, it } from "vitest";
import { sharesToSettle, sharesToUnsettle, userSummaryForBill } from "./bill-balance";

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

  it("shows only unsettled amount when payer has partially paid group bill", () => {
    const partial = userSummaryForBill(
      {
        payerId: "user-a",
        shares: [
          { userId: "user-a", shareCents: 0, settledAt: null, settlementStatus: "NOT_PAID" },
          { userId: "user-b", shareCents: 600, settledAt: null, settlementStatus: "PAID" },
          { userId: "user-c", shareCents: 400, settledAt: null, settlementStatus: "NOT_PAID" },
        ],
      },
      "user-a",
    );

    expect(partial).toMatchObject({
      direction: "owed_to_you",
      amountCents: 400,
      settled: false,
    });
  });

  it("returns one unpaid participant share for payer-targeted settlement", () => {
    expect(
      sharesToSettle(
        {
          payerId: "user-a",
          shares: [
            { id: "share-a", userId: "user-a", shareCents: 1000, settledAt: null, settlementStatus: "NOT_PAID" },
            { id: "share-b", userId: "user-b", shareCents: 700, settledAt: null, settlementStatus: "NOT_PAID" },
            { id: "share-c", userId: "user-c", shareCents: 300, settledAt: null, settlementStatus: "PAID" },
          ],
        },
        "user-a",
        undefined,
        "user-b",
      ),
    ).toEqual(["share-b"]);
  });

  it("does not return already-paid participant share for payer-targeted settlement", () => {
    expect(
      sharesToSettle(
        {
          payerId: "user-a",
          shares: [
            { id: "share-a", userId: "user-a", shareCents: 1000, settledAt: null, settlementStatus: "NOT_PAID" },
            { id: "share-b", userId: "user-b", shareCents: 700, settledAt: null, settlementStatus: "NOT_PAID" },
            { id: "share-c", userId: "user-c", shareCents: 300, settledAt: null, settlementStatus: "PAID" },
          ],
        },
        "user-a",
        undefined,
        "user-c",
      ),
    ).toEqual([]);
  });

  it("returns one paid participant share for payer-targeted unsettle", () => {
    expect(
      sharesToUnsettle(
        {
          payerId: "user-a",
          shares: [
            { id: "share-a", userId: "user-a", shareCents: 1000, settledAt: null, settlementStatus: "NOT_PAID" },
            { id: "share-b", userId: "user-b", shareCents: 700, settledAt: null, settlementStatus: "NOT_PAID" },
            { id: "share-c", userId: "user-c", shareCents: 300, settledAt: null, settlementStatus: "PAID" },
          ],
        },
        "user-a",
        undefined,
        "user-c",
      ),
    ).toEqual(["share-c"]);
  });
});
