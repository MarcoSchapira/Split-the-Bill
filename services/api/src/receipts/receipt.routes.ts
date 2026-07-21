import { Router, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { requireAuth } from "../auth/auth.middleware";
import { currentUser } from "../auth/currentUser";
import { ApiError } from "../http/errors";
import { PostgresRateLimitStore } from "../http/postgres-rate-limit.store";
import { parse } from "./receipt.controller";

const MAX_RECEIPT_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_RECEIPT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const SUPPORTED_RECEIPT_IMAGE_EXTENSION = /\.(?:jpe?g|png|webp|heic|heif)$/i;

function isSupportedReceiptImage(file: Express.Multer.File): boolean {
  if (SUPPORTED_RECEIPT_IMAGE_TYPES.has(file.mimetype.toLowerCase())) {
    return true;
  }

  // Dio uses application/octet-stream for byte uploads unless a media type is
  // supplied. Keep the shipped mobile client compatible when its image filename
  // has a supported extension.
  return (
    file.mimetype.toLowerCase() === "application/octet-stream" &&
    SUPPORTED_RECEIPT_IMAGE_EXTENSION.test(file.originalname)
  );
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RECEIPT_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!isSupportedReceiptImage(file)) {
      cb(
        new ApiError(
          400,
          "UNSUPPORTED_IMAGE_TYPE",
          "Receipt image must be a JPEG, PNG, WebP, HEIC, or HEIF file",
        ),
      );
      return;
    }
    cb(null, true);
  },
});

const requireAiReceiptConsent: RequestHandler = (req, _res, next) => {
  if (!currentUser(req).aiReceiptConsentAt) {
    next(
      new ApiError(
        403,
        "AI_RECEIPT_CONSENT_REQUIRED",
        "AI receipt processing consent is required before uploading a receipt",
      ),
    );
    return;
  }

  next();
};

const parseReceiptRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PostgresRateLimitStore(),
  skip: () => process.env.NODE_ENV === "test",
  keyGenerator: (req) => currentUser(req).id,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many receipt parsing requests. Try again later.",
    },
  },
});

const uploadReceiptImage: RequestHandler = (req, res, next) => {
  upload.single("image")(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        next(
          new ApiError(
            413,
            "IMAGE_TOO_LARGE",
            "Receipt image must be 10 MiB or smaller",
          ),
        );
        return;
      }

      next(new ApiError(400, "INVALID_IMAGE_UPLOAD", "Invalid receipt image upload"));
      return;
    }

    next(error);
  });
};

const router = Router();

router.use(requireAuth);
router.post(
  "/parse",
  requireAiReceiptConsent,
  parseReceiptRateLimit,
  uploadReceiptImage,
  parse,
);

export default router;
