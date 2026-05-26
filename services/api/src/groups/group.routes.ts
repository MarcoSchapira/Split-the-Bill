import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { addMember, create, detail, list } from "./group.controller";

const router = Router();

router.use(requireAuth);
router.post("/", create);
router.get("/", list);
router.get("/:groupId", detail);
router.post("/:groupId/members", addMember);

export default router;
