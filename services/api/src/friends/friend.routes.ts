import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { detail, list } from "./friend.controller";

const router = Router();

router.use(requireAuth);
router.get("/", list);
router.get("/:friendshipId", detail);

export default router;
