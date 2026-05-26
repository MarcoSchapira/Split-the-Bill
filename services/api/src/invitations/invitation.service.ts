import { Prisma } from "../generated/prisma/client";
import { prisma } from "../db/prisma";
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
  sender: { select: safeUserSelect },
  recipient: { select: safeUserSelect },
} as const;

const groupInvitationSelect = {
  id: true,
  status: true,
  createdAt: true,
  respondedAt: true,
  group: { select: { id: true, name: true } },
  sender: { select: safeUserSelect },
  recipient: { select: safeUserSelect },
} as const;

async function findInvitedUser(userId: string, input: InvitationEmailInput) {
  const recipient = await prisma.user.findUnique({
    where: { email: input.email },
    select: safeUserSelect,
  });

  if (!recipient) {
    throw new ApiError(404, "USER_NOT_FOUND", "No registered user found with that email");
  }

  if (recipient.id === userId) {
    throw new ApiError(400, "SELF_INVITATION_NOT_ALLOWED", "You cannot invite yourself");
  }

  return recipient;
}

function friendshipUsers(firstUserId: string, secondUserId: string) {
  return firstUserId < secondUserId
    ? { userAId: firstUserId, userBId: secondUserId }
    : { userAId: secondUserId, userBId: firstUserId };
}

export async function sendFriendInvitation(
  senderId: string,
  input: InvitationEmailInput,
) {
  const recipient = await findInvitedUser(senderId, input);
  const pair = friendshipUsers(senderId, recipient.id);
  const existingFriendship = await prisma.friendship.findUnique({
    where: { userAId_userBId: pair },
  });

  if (existingFriendship) {
    throw new ApiError(409, "ALREADY_FRIENDS", "You are already friends with this user");
  }

  const pending = await prisma.friendInvitation.findFirst({
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

  return prisma.$transaction(async (tx) => {
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
  });
}

export async function sendGroupInvitation(
  senderId: string,
  groupId: string,
  input: InvitationEmailInput,
) {
  await requireGroupMember(senderId, groupId);
  const recipient = await findInvitedUser(senderId, input);
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    select: { id: true, name: true },
  });
  const existingMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: recipient.id } },
  });

  if (existingMember) {
    throw new ApiError(409, "MEMBER_ALREADY_ADDED", "User is already a group member");
  }

  const pending = await prisma.groupInvitation.findFirst({
    where: { groupId, recipientId: recipient.id, status: "pending" },
  });

  if (pending) {
    throw new ApiError(409, "GROUP_INVITATION_PENDING", "A group invitation is already pending");
  }

  return prisma.$transaction(async (tx) => {
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
  });
}

export async function listInvitations(userId: string) {
  const [receivedFriends, sentFriends, receivedGroups, sentGroups] = await Promise.all([
    prisma.friendInvitation.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: "desc" },
      select: friendInvitationSelect,
    }),
    prisma.friendInvitation.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: "desc" },
      select: friendInvitationSelect,
    }),
    prisma.groupInvitation.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: "desc" },
      select: groupInvitationSelect,
    }),
    prisma.groupInvitation.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: "desc" },
      select: groupInvitationSelect,
    }),
  ]);

  return { receivedFriends, sentFriends, receivedGroups, sentGroups };
}

export async function respondToFriendInvitation(
  userId: string,
  invitationId: string,
  input: InvitationDecisionInput,
) {
  const invitation = await prisma.friendInvitation.findUnique({
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
  const pair = friendshipUsers(invitation.senderId, invitation.recipientId);

  try {
    return await prisma.$transaction(async (tx) => {
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
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(409, "ALREADY_FRIENDS", "You are already friends with this user");
    }
    throw error;
  }
}

export async function respondToGroupInvitation(
  userId: string,
  invitationId: string,
  input: InvitationDecisionInput,
) {
  const invitation = await prisma.groupInvitation.findUnique({
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
    return await prisma.$transaction(async (tx) => {
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
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(409, "MEMBER_ALREADY_ADDED", "User is already a group member");
    }
    throw error;
  }
}
