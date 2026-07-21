import path from "node:path";

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

export function normalizeReceiptMimeType(mimeType: string, originalName: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized !== "application/octet-stream") {
    return normalized;
  }

  return MIME_TYPE_BY_EXTENSION[path.extname(originalName).toLowerCase()] ?? normalized;
}

function startsWith(buffer: Buffer, signature: number[]): boolean {
  return signature.every((byte, index) => buffer[index] === byte);
}

/**
 * Detect the supported image type from its bytes. Multer's declared MIME type
 * and filename are client-controlled, so they cannot be the final upload guard.
 */
export function detectReceiptMimeType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("ascii").toLowerCase();
    if (["heic", "heix", "hevc", "hevx"].includes(brand)) {
      return "image/heic";
    }
    if (["heif", "mif1", "msf1"].includes(brand)) {
      return "image/heif";
    }
  }

  return null;
}
