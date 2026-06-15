import type { RequestHandler } from "express";
import { ApiError } from "../http/errors";
import { logParseRequest } from "./receipt.logger";
import { parseReceiptImage } from "./receipt.service";

export const parse: RequestHandler = async (req, res) => {
  const file = req.file;

  if (!file) {
    throw new ApiError(400, "MISSING_IMAGE", "Receipt image is required");
  }

  logParseRequest({
    userId: req.user?.id,
    mimeType: file.mimetype,
    imageBytes: file.size,
  });

  const receipt = await parseReceiptImage(file.buffer, file.mimetype);
  res.json({ receipt });
};
