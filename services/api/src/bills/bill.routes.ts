import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { create, list, remove, update } from "./bill.controller";

const router = Router();

router.use(requireAuth);
router.get("/", list);
router.post("/", create);
router.patch("/:billId", update);
router.delete("/:billId", remove);

export default router;
