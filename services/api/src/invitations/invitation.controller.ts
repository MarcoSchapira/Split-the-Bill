import type { RequestHandler } from "express";
import { currentUser } from "../auth/currentUser";
import { groupIdSchema } from "../groups/group.types";
import {
  invitationDecisionSchema,
  invitationEmailSchema,
  invitationIdSchema,
} from "./invitation.types";
import {
  listInvitations,
  respondToFriendInvitation,
  respondToGroupInvitation,
  sendFriendInvitation,
  sendGroupInvitation,
} from "./invitation.service";

export const sendFriend: RequestHandler = async (req, res) => {
  const invitation = await sendFriendInvitation(
    currentUser(req).id,
    invitationEmailSchema.parse(req.body),
  );
  res.status(201).json({ invitation });
};

export const sendGroup: RequestHandler = async (req, res) => {
  const invitation = await sendGroupInvitation(
    currentUser(req).id,
    groupIdSchema.parse(req.params.groupId),
    invitationEmailSchema.parse(req.body),
  );
  res.status(201).json({ invitation });
};

export const list: RequestHandler = async (req, res) => {
  res.json(await listInvitations(currentUser(req).id));
};

export const respondFriend: RequestHandler = async (req, res) => {
  const invitation = await respondToFriendInvitation(
    currentUser(req).id,
    invitationIdSchema.parse(req.params.invitationId),
    invitationDecisionSchema.parse(req.body),
  );
  res.json({ invitation });
};

export const respondGroup: RequestHandler = async (req, res) => {
  const invitation = await respondToGroupInvitation(
    currentUser(req).id,
    invitationIdSchema.parse(req.params.invitationId),
    invitationDecisionSchema.parse(req.body),
  );
  res.json({ invitation });
};
