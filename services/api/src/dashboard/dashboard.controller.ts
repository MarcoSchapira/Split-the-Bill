import type { RequestHandler } from "express";
import { currentUser } from "../auth/currentUser";
import { getDashboard } from "./dashboard.service";

export const detail: RequestHandler = async (req, res) => {
  const dashboard = await getDashboard(currentUser(req).id);
  res.json({ dashboard });
};
