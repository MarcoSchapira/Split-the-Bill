import { Router } from "express";
import {
  changePassword,
  login,
  logout,
  logoutAll,
  me,
  refresh,
  register,
  sendRegistrationCode,
  updateMe,
} from "./auth.controller";
import { requireAuth } from "./auth.middleware";

const router = Router();

router.post("/register/send-code", sendRegistrationCode);
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/logout-all", requireAuth, logoutAll);
router.post("/change-password", requireAuth, changePassword);
router.get("/me", requireAuth, me);
router.patch("/me", requireAuth, updateMe);

export default router;
