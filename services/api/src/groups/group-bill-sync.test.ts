import { describe, expect, it } from "vitest";
import { equalShares } from "../bills/bill-split";
import { isFullyUnsettledGroupBill } from "./group-bill-sync";

describe("group-bill-sync", () => {
  it("detects fully unsettled group bills", () => {
    expect(
      isFullyUnsettledGroupBill([
        { lenderConfirmedPaid: false },
        { lenderConfirmedPaid: false },
      ]),
    ).toBe(true);

    expect(
      isFullyUnsettledGroupBill([
        { lenderConfirmedPaid: false },
        { lenderConfirmedPaid: true },
      ]),
    ).toBe(false);
  });

  it("builds even shares that sum to the total", () => {
    const shares = equalShares(1000, ["a", "b", "c"]);
    expect(shares).toHaveLength(3);
    expect(shares.reduce((sum, share) => sum + share.shareCents, 0)).toBe(1000);
  });
});
