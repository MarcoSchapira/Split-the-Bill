import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { resolve } from "./target.controller";

const router = Router();

router.use(requireAuth);
router.post("/resolve", resolve);

export default router;
