import { Router } from "express";
import {
  changePassword,
  confirmDeleteAccount,
  deleteAccount,
  login,
  logout,
  logoutAll,
  me,
  recordAiConsent,
  refresh,
  register,
  sendDeleteAccountCode,
  sendRegistrationCode,
  updateMe,
  verifyDeleteAccountCode,
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
router.post("/ai-receipt-consent", requireAuth, recordAiConsent);
router.get("/me", requireAuth, me);
router.patch("/me", requireAuth, updateMe);
router.delete("/account", requireAuth, deleteAccount);
router.post("/account/send-delete-code", sendDeleteAccountCode);
router.post("/account/verify-delete-code", verifyDeleteAccountCode);
router.post("/account/confirm-delete", confirmDeleteAccount);

export default router;
