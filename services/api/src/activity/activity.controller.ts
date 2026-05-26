import type { RequestHandler } from "express";
import { currentUser } from "../auth/currentUser";
import { listActivity } from "./activity.service";

export const list: RequestHandler = async (req, res) => {
  const activity = await listActivity(currentUser(req).id);
  res.json({ activity });
};
