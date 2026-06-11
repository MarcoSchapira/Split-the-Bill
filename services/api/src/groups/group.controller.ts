import type { RequestHandler } from "express";
import { currentUser } from "../auth/currentUser";
import { withUserContext } from "../db/userContext";
import { createGroup, getGroup, listGroups } from "./group.service";
import { createGroupSchema, groupIdSchema } from "./group.types";

export const create: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const group = await withUserContext(userId, (tx) =>
    createGroup(tx, userId, createGroupSchema.parse(req.body)),
  );
  res.status(201).json({ group });
};

export const list: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const groups = await withUserContext(userId, (tx) => listGroups(tx, userId));
  res.json({ groups });
};

export const detail: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const group = await withUserContext(userId, (tx) =>
    getGroup(tx, userId, groupIdSchema.parse(req.params.groupId)),
  );
  res.json({ group });
};
