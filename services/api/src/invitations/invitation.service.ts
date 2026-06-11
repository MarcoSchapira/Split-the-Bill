import { Prisma } from "../generated/prisma/client";
import type { PrismaTransaction } from "../db/userContext";
import { safeUserSelect } from "../auth/auth.types";
import { ApiError } from "../http/errors";
import { requireGroupMember } from "../groups/group.authorization";
import { createActivity } from "../activity/activity.service";
import type {
  InvitationDecisionInput,
  InvitationEmailInput,
} from "./invitation.types";

const friendInvitationSelect = {
  id: true,
  status: true,
  createdAt: true,
  respondedAt: true,
  recipientEmail: true,
  sender: { select: safeUserSelect },
  recipient: { select: safeUserSelect },
} as const;

const groupInvitationSelect = {
  id: true,
  status: true,
  createdAt: true,
  respondedAt: true,
  recipientEmail: true,
  group: { select: { id: true, name: true } },
  sender: { select: safeUserSelect },
  recipient: { select: safeUserSelect },
} as const;

function friendshipUsers(firstUserId: string, secondUserId: string) {
  return firstUserId < secondUserId
    ? { userAId: firstUserId, userBId: secondUserId }
    : { userAId: secondUserId, userBId: firstUserId };
}


export async function sendFriendInvitation(
  tx: PrismaTransaction,
  senderId: string,
  input: InvitationEmailInput,
) {
  const recipient = await tx.user.findUnique({
    where: { email: input.email },
    select: safeUserSelect,
  });

  if (recipient?.id === senderId) {
    throw new ApiError(400, "SELF_INVITATION_NOT_ALLOWED", "You cannot invite yourself");
  }

  if (recipient) {
    const pair = friendshipUsers(senderId, recipient.id);
    const existingFriendship = await tx.friendship.findUnique({
      where: { userAId_userBId: pair },
    });

    if (existingFriendship) {
      throw new ApiError(409, "ALREADY_FRIENDS", "You are already friends with this user");
    }

    const pending = await tx.friendInvitation.findFirst({
      where: {
        status: "pending",
        OR: [
          { senderId, recipientId: recipient.id },
          { senderId: recipient.id, recipientId: senderId },
        ],
      },
    });

    if (pending) {
      throw new ApiError(409, "FRIEND_INVITATION_PENDING", "A friend invitation is already pending");
    }

    const invitation = await tx.friendInvitation.create({
      data: { senderId, recipientId: recipient.id },
      select: friendInvitationSelect,
    });
    await createActivity(tx, {
      actorId: senderId,
      recipientIds: [recipient.id],
      friendInvitationId: invitation.id,
      type: "FRIEND_INVITATION_SENT",
      message: "sent a friend invitation.",
    });
    return invitation;
  }

  const pendingEmailInvite = await tx.friendInvitation.findFirst({
    where: {
      senderId,
      recipientEmail: input.email,
      status: "pending",
    },
  });

  if (pendingEmailInvite) {
    throw new ApiError(409, "FRIEND_INVITATION_PENDING", "A friend invitation is already pending");
  }

  return tx.friendInvitation.create({
    data: {
      senderId,
      recipientEmail: input.email,
    },
    select: friendInvitationSelect,
  });
}

export async function sendGroupInvitation(
  tx: PrismaTransaction,
  senderId: string,
  groupId: string,
  input: InvitationEmailInput,
) {
  await requireGroupMember(tx, senderId, groupId);

  const recipient = await tx.user.findUnique({
    where: { email: input.email },
    select: safeUserSelect,
  });

  if (recipient?.id === senderId) {
    throw new ApiError(400, "SELF_INVITATION_NOT_ALLOWED", "You cannot invite yourself");
  }

  const group = await tx.group.findUniqueOrThrow({
    where: { id: groupId },
    select: { id: true, name: true },
  });

  if (recipient) {
    const existingMember = await tx.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: recipient.id } },
    });

    if (existingMember) {
      throw new ApiError(409, "MEMBER_ALREADY_ADDED", "User is already a group member");
    }

    const pending = await tx.groupInvitation.findFirst({
      where: { groupId, recipientId: recipient.id, status: "pending" },
    });

    if (pending) {
      throw new ApiError(409, "GROUP_INVITATION_PENDING", "A group invitation is already pending");
    }

    const invitation = await tx.groupInvitation.create({
      data: { groupId, senderId, recipientId: recipient.id },
      select: groupInvitationSelect,
    });
    await createActivity(tx, {
      actorId: senderId,
      recipientIds: [recipient.id],
      groupInvitationId: invitation.id,
      type: "GROUP_INVITATION_SENT",
      message: `sent an invitation to join ${group.name}.`,
    });
    return invitation;
  }

  const pendingEmailInvite = await tx.groupInvitation.findFirst({
    where: {
      groupId,
      recipientEmail: input.email,
      status: "pending",
    },
  });

  if (pendingEmailInvite) {
    throw new ApiError(409, "GROUP_INVITATION_PENDING", "A group invitation is already pending");
  }

  return tx.groupInvitation.create({
    data: {
      groupId,
      senderId,
      recipientEmail: input.email,
    },
    select: groupInvitationSelect,
  });
}

export async function listInvitations(tx: PrismaTransaction, userId: string) {
  const [receivedFriends, sentFriends, receivedGroups, sentGroups] = await Promise.all([
    tx.friendInvitation.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: "desc" },
      select: friendInvitationSelect,
    }),
    tx.friendInvitation.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: "desc" },
      select: friendInvitationSelect,
    }),
    tx.groupInvitation.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: "desc" },
      select: groupInvitationSelect,
    }),
    tx.groupInvitation.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: "desc" },
      select: groupInvitationSelect,
    }),
  ]);

  return { receivedFriends, sentFriends, receivedGroups, sentGroups };
}

export async function respondToFriendInvitation(
  tx: PrismaTransaction,
  userId: string,
  invitationId: string,
  input: InvitationDecisionInput,
) {
  const invitation = await tx.friendInvitation.findUnique({
    where: { id: invitationId },
    include: { sender: { select: safeUserSelect }, recipient: { select: safeUserSelect } },
  });

  if (!invitation || invitation.recipientId !== userId) {
    throw new ApiError(404, "INVITATION_NOT_FOUND", "Invitation not found");
  }

  if (invitation.status !== "pending") {
    throw new ApiError(409, "INVITATION_ALREADY_RESPONDED", "Invitation has already been answered");
  }

  const status = input.decision === "accept" ? "accepted" : "declined";
  const pair = friendshipUsers(invitation.senderId, invitation.recipientId!);

  try {
    if (status === "accepted") {
      await tx.friendship.create({ data: pair });
    }

    const updated = await tx.friendInvitation.update({
      where: { id: invitationId },
      data: { status, respondedAt: new Date() },
      select: friendInvitationSelect,
    });
    await createActivity(tx, {
      actorId: userId,
      recipientIds: [invitation.senderId],
      friendInvitationId: invitation.id,
      type: status === "accepted" ? "FRIEND_INVITATION_ACCEPTED" : "FRIEND_INVITATION_DECLINED",
      message: `${status} a friend invitation.`,
    });
    return updated;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(409, "ALREADY_FRIENDS", "You are already friends with this user");
    }
    throw error;
  }
}

export async function respondToGroupInvitation(
  tx: PrismaTransaction,
  userId: string,
  invitationId: string,
  input: InvitationDecisionInput,
) {
  const invitation = await tx.groupInvitation.findUnique({
    where: { id: invitationId },
    include: { group: { select: { name: true } } },
  });

  if (!invitation || invitation.recipientId !== userId) {
    throw new ApiError(404, "INVITATION_NOT_FOUND", "Invitation not found");
  }

  if (invitation.status !== "pending") {
    throw new ApiError(409, "INVITATION_ALREADY_RESPONDED", "Invitation has already been answered");
  }

  const status = input.decision === "accept" ? "accepted" : "declined";

  try {
    if (status === "accepted") {
      await tx.groupMember.create({
        data: { groupId: invitation.groupId, userId, role: "member" },
      });
    }

    const updated = await tx.groupInvitation.update({
      where: { id: invitationId },
      data: { status, respondedAt: new Date() },
      select: groupInvitationSelect,
    });
    await createActivity(tx, {
      actorId: userId,
      recipientIds: [invitation.senderId],
      groupInvitationId: invitation.id,
      type: status === "accepted" ? "GROUP_INVITATION_ACCEPTED" : "GROUP_INVITATION_DECLINED",
      message: `${status} an invitation to join ${invitation.group.name}.`,
    });
    return updated;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(409, "MEMBER_ALREADY_ADDED", "User is already a group member");
    }
    throw error;
  }
}
