import type { RequestHandler } from "express";
import { z } from "zod";
import { currentUser } from "../auth/currentUser";
import { withUserContext } from "../db/userContext";
import { dismissActivity, listActivity } from "./activity.service";

const activityEventIdSchema = z.string().uuid();

export const list: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const activity = await withUserContext(userId, (tx) => listActivity(tx, userId));
  res.json({ activity });
};

export const remove: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  await withUserContext(userId, (tx) =>
    dismissActivity(tx, userId, activityEventIdSchema.parse(req.params.eventId)),
  );
  res.status(204).send();
};
