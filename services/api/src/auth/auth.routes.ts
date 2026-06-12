import { Router } from "express";
import { login, logout, me, refresh, register, sendRegistrationCode } from "./auth.controller";
import { requireAuth } from "./auth.middleware";

const router = Router();

router.post("/register/send-code", sendRegistrationCode);
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", requireAuth, me);

export default router;
