import type { RequestHandler } from "express";
import { ApiError } from "../http/errors";
import { logParseRequest } from "./receipt.logger";
import { detectReceiptMimeType } from "./receipt.mime";
import { parseReceiptImage } from "./receipt.service";

export const parse: RequestHandler = async (req, res) => {
  const file = req.file;

  if (!file) {
    throw new ApiError(400, "MISSING_IMAGE", "Receipt image is required");
  }

  const mimeType = detectReceiptMimeType(file.buffer);
  if (!mimeType) {
    throw new ApiError(
      400,
      "UNSUPPORTED_IMAGE_TYPE",
      "Receipt image must contain valid JPEG, PNG, WebP, HEIC, or HEIF data",
    );
  }

  logParseRequest({
    userId: req.user?.id,
    mimeType,
    imageBytes: file.size,
  });

  const receipt = await parseReceiptImage(file.buffer, mimeType);
  res.json({ receipt });
};
