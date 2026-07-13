import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import {
  addMember,
  create,
  detail,
  leave,
  list,
  remove,
  removeMember,
  update,
} from "./group.controller";

const router = Router();

router.use(requireAuth);
router.get("/", list);
router.post("/", create);
router.get("/:groupId", detail);
router.patch("/:groupId", update);
router.delete("/:groupId", remove);
router.post("/:groupId/members", addMember);
router.delete("/:groupId/members/:userId", removeMember);
router.post("/:groupId/leave", leave);

export default router;
