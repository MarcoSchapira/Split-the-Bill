import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { list, respondFriend, sendFriend } from "./invitation.controller";

const router = Router();

router.use(requireAuth);
router.get("/invitations", list);
router.post("/friend-invitations", sendFriend);
router.patch("/friend-invitations/:invitationId", respondFriend);

export default router;
