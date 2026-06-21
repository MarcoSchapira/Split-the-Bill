import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { list, remove } from "./activity.controller";

const router = Router();

router.use(requireAuth);
router.get("/", list);
router.delete("/:eventId", remove);

export default router;
