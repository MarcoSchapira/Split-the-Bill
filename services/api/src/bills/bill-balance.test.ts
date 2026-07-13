import { describe, expect, it } from "vitest";
import { sharesToSettle, sharesToUnsettle, userSummaryForBill } from "./bill-balance";

const unsettled = {
  payerMarkedAsPaid: false,
  lenderConfirmedPaid: false,
};

const shares = [
  { id: "share-a", userId: "user-a", shareCents: 500, ...unsettled },
  { id: "share-b", userId: "user-b", shareCents: 500, ...unsettled },
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

  it("marks settled friendship debt when the lender confirms", () => {
    const settledShares = [
      shares[0],
      { ...shares[1], lenderConfirmedPaid: true },
    ];

    expect(
      userSummaryForBill({ payerId: "user-a", shares: settledShares }, "user-a", "user-b"),
    ).toMatchObject({
      amountCents: 500,
      direction: "owed_to_you",
      settled: true,
    });
  });

  it("does not settle when only the debtor marks as paid", () => {
    const debtorMarkedShares = [
      shares[0],
      { ...shares[1], payerMarkedAsPaid: true, lenderConfirmedPaid: false },
    ];

    expect(
      userSummaryForBill({ payerId: "user-a", shares: debtorMarkedShares }, "user-a", "user-b"),
    ).toMatchObject({
      amountCents: 500,
      direction: "owed_to_you",
      settled: false,
    });
  });

  it("returns debtor share ids for group payer settlement", () => {
    expect(
      sharesToSettle(
        {
          payerId: "user-a",
          shares: [
            { id: "share-a", userId: "user-a", shareCents: 1000, ...unsettled },
            { id: "share-b", userId: "user-b", shareCents: 1000, ...unsettled },
            { id: "share-c", userId: "user-c", shareCents: 1000, ...unsettled },
          ],
        },
        "user-a",
      ),
    ).toEqual(["share-b", "share-c"]);
  });

  it("shows only unsettled amount when payer has partially confirmed group bill", () => {
    const partial = userSummaryForBill(
      {
        payerId: "user-a",
        shares: [
          { userId: "user-a", shareCents: 0, ...unsettled },
          { userId: "user-b", shareCents: 600, payerMarkedAsPaid: false, lenderConfirmedPaid: true },
          { userId: "user-c", shareCents: 400, ...unsettled },
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

  it("returns one unconfirmed participant share for payer-targeted settlement", () => {
    expect(
      sharesToSettle(
        {
          payerId: "user-a",
          shares: [
            { id: "share-a", userId: "user-a", shareCents: 1000, ...unsettled },
            { id: "share-b", userId: "user-b", shareCents: 700, ...unsettled },
            { id: "share-c", userId: "user-c", shareCents: 300, payerMarkedAsPaid: false, lenderConfirmedPaid: true },
          ],
        },
        "user-a",
        undefined,
        "user-b",
      ),
    ).toEqual(["share-b"]);
  });

  it("does not return already-confirmed participant share for payer-targeted settlement", () => {
    expect(
      sharesToSettle(
        {
          payerId: "user-a",
          shares: [
            { id: "share-a", userId: "user-a", shareCents: 1000, ...unsettled },
            { id: "share-b", userId: "user-b", shareCents: 700, ...unsettled },
            { id: "share-c", userId: "user-c", shareCents: 300, payerMarkedAsPaid: false, lenderConfirmedPaid: true },
          ],
        },
        "user-a",
        undefined,
        "user-c",
      ),
    ).toEqual([]);
  });

  it("returns one confirmed participant share for payer-targeted unsettle", () => {
    expect(
      sharesToUnsettle(
        {
          payerId: "user-a",
          shares: [
            { id: "share-a", userId: "user-a", shareCents: 1000, ...unsettled },
            { id: "share-b", userId: "user-b", shareCents: 700, ...unsettled },
            { id: "share-c", userId: "user-c", shareCents: 300, payerMarkedAsPaid: false, lenderConfirmedPaid: true },
          ],
        },
        "user-a",
        undefined,
        "user-c",
      ),
    ).toEqual(["share-c"]);
  });

  it("lets debtor mark their share when lender has not confirmed", () => {
    expect(
      sharesToSettle(
        {
          payerId: "user-a",
          shares,
        },
        "user-b",
        "user-a",
      ),
    ).toEqual(["share-b"]);
  });

  it("does not let debtor re-mark after they already marked", () => {
    expect(
      sharesToSettle(
        {
          payerId: "user-a",
          shares: [
            shares[0],
            { ...shares[1], payerMarkedAsPaid: true, lenderConfirmedPaid: false },
          ],
        },
        "user-b",
        "user-a",
      ),
    ).toEqual([]);
  });
});
