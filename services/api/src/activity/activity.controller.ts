import type { RequestHandler } from "express";
import { currentUser } from "../auth/currentUser";
import { withUserContext } from "../db/userContext";
import { listActivity } from "./activity.service";

export const list: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const activity = await withUserContext(userId, (tx) => listActivity(tx, userId));
  res.json({ activity });
};
