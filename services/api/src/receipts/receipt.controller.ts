import type { RequestHandler } from "express";
import { ApiError } from "../http/errors";
import { parseReceiptImage } from "./receipt.service";

export const parse: RequestHandler = async (req, res) => {
  const file = req.file;

  if (!file) {
    throw new ApiError(400, "MISSING_IMAGE", "Receipt image is required");
  }

  const receipt = await parseReceiptImage(file.buffer, file.mimetype);
  res.json({ receipt });
};
