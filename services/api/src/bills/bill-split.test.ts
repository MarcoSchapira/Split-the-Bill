import { describe, expect, it } from "vitest";
import { buildSharesFromInput, equalShares } from "./bill-split";

describe("bill split allocation", () => {
  it("assigns the whole equal-split rounding remainder to the payer", () => {
    expect(equalShares(1000, ["friend-b", "payer", "friend-a"], "payer")).toEqual([
      { userId: "friend-a", shareCents: 333 },
      { userId: "friend-b", shareCents: 333 },
      { userId: "payer", shareCents: 334 },
    ]);
  });

  it("uses the payer as the implicit remainder recipient", () => {
    expect(buildSharesFromInput(1001, ["payer", "friend"], undefined, "payer")).toEqual([
      { userId: "friend", shareCents: 500 },
      { userId: "payer", shareCents: 501 },
    ]);
  });
});
