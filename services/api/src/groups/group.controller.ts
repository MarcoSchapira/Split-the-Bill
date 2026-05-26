import type { RequestHandler } from "express";
import { currentUser } from "../auth/currentUser";
import { createGroup, getGroup, listGroups } from "./group.service";
import { createGroupSchema, groupIdSchema } from "./group.types";

export const create: RequestHandler = async (req, res) => {
  const group = await createGroup(currentUser(req).id, createGroupSchema.parse(req.body));
  res.status(201).json({ group });
};

export const list: RequestHandler = async (req, res) => {
  const groups = await listGroups(currentUser(req).id);
  res.json({ groups });
};

export const detail: RequestHandler = async (req, res) => {
  const group = await getGroup(currentUser(req).id, groupIdSchema.parse(req.params.groupId));
  res.json({ group });
};
