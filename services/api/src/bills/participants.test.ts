import { describe, expect, it } from "vitest";
import { sortedParticipantKey } from "./participants";

describe("sortedParticipantKey", () => {
  it("dedupes and sorts participant ids", () => {
    expect(
      sortedParticipantKey([
        "b2222222-2222-4222-8222-222222222222",
        "a1111111-1111-4111-8111-111111111111",
        "b2222222-2222-4222-8222-222222222222",
      ]),
    ).toEqual([
      "a1111111-1111-4111-8111-111111111111",
      "b2222222-2222-4222-8222-222222222222",
    ]);
  });
});
