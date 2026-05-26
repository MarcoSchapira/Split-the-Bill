import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { list } from "./activity.controller";

const router = Router();

router.use(requireAuth);
router.get("/", list);

export default router;
