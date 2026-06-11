import type { RequestHandler } from "express";
import { currentUser } from "../auth/currentUser";
import { withUserContext } from "../db/userContext";
import { getDashboard } from "./dashboard.service";

export const detail: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const dashboard = await withUserContext(userId, (tx) => getDashboard(tx, userId));
  res.json({ dashboard });
};
