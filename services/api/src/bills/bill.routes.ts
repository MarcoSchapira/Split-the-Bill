import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { create, get, list, remove, settle, update } from "./bill.controller";

const router = Router();

router.use(requireAuth);
router.get("/", list);
router.get("/:billId", get);
router.post("/", create);
router.patch("/:billId", update);
router.post("/:billId/settle", settle);
router.delete("/:billId", remove);

export default router;
