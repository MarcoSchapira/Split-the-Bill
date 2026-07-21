import { describe, expect, it } from "vitest";
import { detectReceiptMimeType, normalizeReceiptMimeType } from "./receipt.mime";

describe("normalizeReceiptMimeType", () => {
  it.each([
    ["receipt.jpg", "image/jpeg"],
    ["receipt.JPEG", "image/jpeg"],
    ["receipt.png", "image/png"],
    ["receipt.webp", "image/webp"],
    ["receipt.heic", "image/heic"],
    ["receipt.heif", "image/heif"],
  ])("normalizes Dio byte uploads named %s", (filename, expected) => {
    expect(normalizeReceiptMimeType("application/octet-stream", filename)).toBe(expected);
  });

  it("preserves an explicit supported media type", () => {
    expect(normalizeReceiptMimeType("image/png", "receipt.jpg")).toBe("image/png");
  });

  it.each([
    [Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg"],
    [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"],
    [Buffer.from("RIFF0000WEBP", "ascii"), "image/webp"],
    [Buffer.from("0000ftypheic", "ascii"), "image/heic"],
    [Buffer.from("0000ftypmif1", "ascii"), "image/heif"],
  ])("detects supported image signatures", (buffer, expected) => {
    expect(detectReceiptMimeType(buffer)).toBe(expected);
  });

  it("rejects arbitrary bytes even when a caller labels them as an image", () => {
    expect(detectReceiptMimeType(Buffer.from("not an image"))).toBeNull();
  });
});
