import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { sendGroup } from "../invitations/invitation.controller";
import { create, detail, list } from "./group.controller";

const router = Router();

router.use(requireAuth);
router.post("/", create);
router.get("/", list);
router.get("/:groupId", detail);
router.post("/:groupId/invitations", sendGroup);

export default router;
