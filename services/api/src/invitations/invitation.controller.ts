import type { RequestHandler } from "express";
import { currentUser } from "../auth/currentUser";
import { withUserContext } from "../db/userContext";
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
  const userId = currentUser(req).id;
  const invitation = await withUserContext(userId, (tx) =>
    sendFriendInvitation(tx, userId, invitationEmailSchema.parse(req.body)),
  );
  res.status(201).json({ invitation });
};

export const sendGroup: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const invitation = await withUserContext(userId, (tx) =>
    sendGroupInvitation(
      tx,
      userId,
      groupIdSchema.parse(req.params.groupId),
      invitationEmailSchema.parse(req.body),
    ),
  );
  res.status(201).json({ invitation });
};

export const list: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const invitations = await withUserContext(userId, (tx) => listInvitations(tx, userId));
  res.json(invitations);
};

export const respondFriend: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const invitation = await withUserContext(userId, (tx) =>
    respondToFriendInvitation(
      tx,
      userId,
      invitationIdSchema.parse(req.params.invitationId),
      invitationDecisionSchema.parse(req.body),
    ),
  );
  res.json({ invitation });
};

export const respondGroup: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const invitation = await withUserContext(userId, (tx) =>
    respondToGroupInvitation(
      tx,
      userId,
      invitationIdSchema.parse(req.params.invitationId),
      invitationDecisionSchema.parse(req.body),
    ),
  );
  res.json({ invitation });
};
