import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../auth/auth.middleware";
import { parse } from "./receipt.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image uploads are allowed"));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

router.use(requireAuth);
router.post("/parse", upload.single("image"), parse);

export default router;
