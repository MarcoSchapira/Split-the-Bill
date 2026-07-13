import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { list, cancelFriend, respondFriend, sendFriend } from "./invitation.controller";

const router = Router();

router.use(requireAuth);
router.get("/invitations", list);
router.post("/friend-invitations", sendFriend);
router.patch("/friend-invitations/:invitationId", respondFriend);
router.delete("/friend-invitations/:invitationId", cancelFriend);

export default router;
