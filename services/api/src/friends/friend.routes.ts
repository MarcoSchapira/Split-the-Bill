import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { detail, list, remove, settle } from "./friend.controller";

const router = Router();

router.use(requireAuth);
router.get("/", list);
router.get("/:friendshipId", detail);
router.post("/:friendshipId/settle", settle);
router.delete("/:friendshipId", remove);

export default router;
