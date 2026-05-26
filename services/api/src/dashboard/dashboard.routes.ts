import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { detail } from "./dashboard.controller";

const router = Router();

router.use(requireAuth);
router.get("/", detail);

export default router;
