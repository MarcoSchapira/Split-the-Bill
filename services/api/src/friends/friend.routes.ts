import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { detail, list, settle } from "./friend.controller";

const router = Router();

router.use(requireAuth);
router.get("/", list);
router.get("/:friendshipId", detail);
router.post("/:friendshipId/settle", settle);

export default router;
