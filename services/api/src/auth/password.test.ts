import { describe, expect, it } from "vitest";
import { comparePassword, hashPassword } from "./password";

describe("password helpers", () => {
  it("hashes passwords without preserving the raw password", async () => {
    const password = "correct horse battery staple";
    const hash = await hashPassword(password);

    expect(typeof hash).toBe("string");
    expect(hash).not.toBe(password);
    await expect(comparePassword(password, hash)).resolves.toBe(true);
    await expect(comparePassword("wrong password", hash)).resolves.toBe(false);
  });
});
