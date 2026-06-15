import type { RequestHandler } from "express";
import { currentUser } from "../auth/currentUser";
import { withUserContext } from "../db/userContext";
import { resolveBillTarget } from "./target.service";
import { resolveTargetInputSchema } from "./target.types";

export const resolve: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const target = await withUserContext(userId, (tx) =>
    resolveBillTarget(tx, userId, resolveTargetInputSchema.parse(req.body)),
  );
  res.json({ target });
};
