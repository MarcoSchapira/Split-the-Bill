import type { RequestHandler } from "express";
import { currentUser } from "../auth/currentUser";
import { withUserContext } from "../db/userContext";
import {
  addGroupMemberSchema,
  createGroupSchema,
  groupIdSchema,
  membershipChangeSchema,
  updateGroupSchema,
} from "./group.types";
import {
  addGroupMember,
  createGroup,
  deleteGroup,
  getGroup,
  leaveGroup,
  listGroups,
  removeGroupMember,
  updateGroup,
} from "./group.service";

export const list: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const groups = await withUserContext(userId, (tx) => listGroups(tx, userId));
  res.json({ groups });
};

export const create: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const input = createGroupSchema.parse(req.body);
  const group = await withUserContext(userId, (tx) => createGroup(tx, userId, input));
  res.status(201).json({ group });
};

export const detail: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const groupId = groupIdSchema.parse(req.params.groupId);
  const group = await withUserContext(userId, (tx) => getGroup(tx, userId, groupId));
  res.json({ group });
};

export const update: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const groupId = groupIdSchema.parse(req.params.groupId);
  const input = updateGroupSchema.parse(req.body);
  const group = await withUserContext(userId, (tx) => updateGroup(tx, userId, groupId, input));
  res.json({ group });
};

export const remove: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const groupId = groupIdSchema.parse(req.params.groupId);
  await withUserContext(userId, (tx) => deleteGroup(tx, userId, groupId));
  res.status(204).send();
};

export const addMember: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const groupId = groupIdSchema.parse(req.params.groupId);
  const input = addGroupMemberSchema.parse(req.body);
  const group = await withUserContext(userId, (tx) =>
    addGroupMember(tx, userId, groupId, input),
  );
  res.json({ group });
};

export const removeMember: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const groupId = groupIdSchema.parse(req.params.groupId);
  const memberUserId = groupIdSchema.parse(req.params.userId);
  const input = membershipChangeSchema.parse(req.body ?? {});
  const group = await withUserContext(userId, (tx) =>
    removeGroupMember(tx, userId, groupId, memberUserId, input),
  );
  res.json({ group });
};

export const leave: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const groupId = groupIdSchema.parse(req.params.groupId);
  const input = membershipChangeSchema.parse(req.body ?? {});
  const group = await withUserContext(userId, (tx) => leaveGroup(tx, userId, groupId, input));

  if (!group) {
    res.status(204).send();
    return;
  }

  res.json({ group });
};
