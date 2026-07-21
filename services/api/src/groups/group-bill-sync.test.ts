import { describe, expect, it } from "vitest";
import { equalShares, sharesWithLenderId } from "../bills/bill-split";
import { hasUnresolvedGroupBalance } from "./group-bill-sync";

describe("group-bill-sync", () => {
  it("keeps a partially settled bill unresolved while any debtor remains", () => {
    expect(
      hasUnresolvedGroupBalance([
        { userId: "payer", lenderId: "payer", shareCents: 333, lenderConfirmedPaid: false },
        { userId: "friend-a", lenderId: "payer", shareCents: 333, lenderConfirmedPaid: true },
        { userId: "friend-b", lenderId: "payer", shareCents: 334, lenderConfirmedPaid: false },
      ]),
    ).toBe(true);

    expect(
      hasUnresolvedGroupBalance([
        { userId: "payer", lenderId: "payer", shareCents: 333, lenderConfirmedPaid: false },
        { userId: "friend", lenderId: "payer", shareCents: 667, lenderConfirmedPaid: true },
      ]),
    ).toBe(false);
  });

  it("builds even shares that sum to the total", () => {
    const shares = equalShares(1000, ["a", "b", "c"], "b");
    expect(shares).toHaveLength(3);
    expect(shares.reduce((sum, share) => sum + share.shareCents, 0)).toBe(1000);
    expect(shares.find((share) => share.userId === "b")?.shareCents).toBe(334);
  });

  it("copies payerId onto each share as lenderId", () => {
    const shares = sharesWithLenderId(equalShares(1000, ["a", "b"]), "payer-1");
    expect(shares.every((share) => share.lenderId === "payer-1")).toBe(true);
  });

});
