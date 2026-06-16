import { Prisma } from "../generated/prisma/client";
import type { PrismaTransaction } from "../db/userContext";
import { prismaAdmin } from "../db/prisma";
import { safeUserSelect } from "../auth/auth.types";
import { ApiError } from "../http/errors";
import { requireGroupMember } from "../groups/group.authorization";
import { createActivity } from "../activity/activity.service";
import type {
  InvitationDecisionInput,
  InvitationEmailInput,
} from "./invitation.types";

async function findRegisteredInviteRecipient(email: string) {
  return prismaAdmin.user.findUnique({
    where: { email },
    select: safeUserSelect,
  });
}

function receivedInvitationFilter(userId: string, email: string) {
  return {
    OR: [{ recipientId: userId }, { recipientId: null, recipientEmail: email }],
  };
}

function isInvitationRecipient(
  invitation: { recipientId: string | null; recipientEmail: string | null },
  userId: string,
  email: string,
) {
  return (
    invitation.recipientId === userId ||
    (invitation.recipientId === null && invitation.recipientEmail === email)
  );
}

const friendInvitationSelect = {
  id: true,
  status: true,
  createdAt: true,
  respondedAt: true,
  recipientEmail: true,
  sender: { select: safeUserSelect },
  recipient: { select: safeUserSelect },
} as const;

const friendInvitationListSelect = {
  ...friendInvitationSelect,
  senderId: true,
  recipientId: true,
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

const groupInvitationListSelect = {
  ...groupInvitationSelect,
  groupId: true,
  senderId: true,
  recipientId: true,
} as const;

type SafeUser = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
};

type GroupSummary = {
  id: string;
  name: string;
};

async function loadUsersById(userIds: string[]): Promise<Map<string, SafeUser>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const users = await prismaAdmin.user.findMany({
    where: { id: { in: userIds } },
    select: safeUserSelect,
  });

  return new Map(users.map((user) => [user.id, user]));
}

async function loadGroupsById(groupIds: string[]): Promise<Map<string, GroupSummary>> {
  if (groupIds.length === 0) {
    return new Map();
  }

  const groups = await prismaAdmin.group.findMany({
    where: { id: { in: groupIds } },
    select: { id: true, name: true },
  });

  return new Map(groups.map((group) => [group.id, group]));
}

function collectInvitationUserIds(
  invitations: Array<{ senderId: string; recipientId: string | null }>,
  userIds: Set<string>,
) {
  for (const invitation of invitations) {
    userIds.add(invitation.senderId);
    if (invitation.recipientId) {
      userIds.add(invitation.recipientId);
    }
  }
}

function hydrateFriendInvitations<
  T extends {
    senderId: string;
    recipientId: string | null;
    sender: SafeUser | null;
    recipient: SafeUser | null;
  },
>(invitations: T[], usersById: Map<string, SafeUser>) {
  return invitations.map(({ senderId, recipientId, sender, recipient, ...invitation }) => ({
    ...invitation,
    sender: sender ?? usersById.get(senderId)!,
    recipient: recipientId ? (recipient ?? usersById.get(recipientId) ?? null) : recipient,
  }));
}

function hydrateGroupInvitations<
  T extends {
    groupId: string;
    senderId: string;
    recipientId: string | null;
    group: GroupSummary | null;
    sender: SafeUser | null;
    recipient: SafeUser | null;
  },
>(invitations: T[], usersById: Map<string, SafeUser>, groupsById: Map<string, GroupSummary>) {
  return invitations.map(
    ({ groupId, senderId, recipientId, group, sender, recipient, ...invitation }) => ({
      ...invitation,
      group: group ?? groupsById.get(groupId)!,
      sender: sender ?? usersById.get(senderId)!,
      recipient: recipientId ? (recipient ?? usersById.get(recipientId) ?? null) : recipient,
    }),
  );
}

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
  const recipient = await findRegisteredInviteRecipient(input.email);

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

  const recipient = await findRegisteredInviteRecipient(input.email);

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
  const currentUser = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true },
  });
  const receivedFilter = receivedInvitationFilter(userId, currentUser.email);

  const [receivedFriendsRaw, sentFriendsRaw, receivedGroupsRaw, sentGroupsRaw] =
    await Promise.all([
      tx.friendInvitation.findMany({
        where: receivedFilter,
        orderBy: { createdAt: "desc" },
        select: friendInvitationListSelect,
      }),
      tx.friendInvitation.findMany({
        where: { senderId: userId },
        orderBy: { createdAt: "desc" },
        select: friendInvitationListSelect,
      }),
      tx.groupInvitation.findMany({
        where: receivedFilter,
        orderBy: { createdAt: "desc" },
        select: groupInvitationListSelect,
      }),
      tx.groupInvitation.findMany({
        where: { senderId: userId },
        orderBy: { createdAt: "desc" },
        select: groupInvitationListSelect,
      }),
    ]);

  const userIds = new Set<string>();
  collectInvitationUserIds(receivedFriendsRaw, userIds);
  collectInvitationUserIds(sentFriendsRaw, userIds);
  collectInvitationUserIds(receivedGroupsRaw, userIds);
  collectInvitationUserIds(sentGroupsRaw, userIds);

  const groupIds = [...receivedGroupsRaw, ...sentGroupsRaw].map((invitation) => invitation.groupId);
  const [usersById, groupsById] = await Promise.all([
    loadUsersById([...userIds]),
    loadGroupsById(groupIds),
  ]);

  return {
    receivedFriends: hydrateFriendInvitations(receivedFriendsRaw, usersById),
    sentFriends: hydrateFriendInvitations(sentFriendsRaw, usersById),
    receivedGroups: hydrateGroupInvitations(receivedGroupsRaw, usersById, groupsById),
    sentGroups: hydrateGroupInvitations(sentGroupsRaw, usersById, groupsById),
  };
}

export async function respondToFriendInvitation(
  tx: PrismaTransaction,
  userId: string,
  invitationId: string,
  input: InvitationDecisionInput,
) {
  const currentUser = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true },
  });
  const invitation = await tx.friendInvitation.findUnique({
    where: { id: invitationId },
    include: { sender: { select: safeUserSelect }, recipient: { select: safeUserSelect } },
  });

  if (!invitation || !isInvitationRecipient(invitation, userId, currentUser.email)) {
    throw new ApiError(404, "INVITATION_NOT_FOUND", "Invitation not found");
  }

  if (invitation.status !== "pending") {
    throw new ApiError(409, "INVITATION_ALREADY_RESPONDED", "Invitation has already been answered");
  }

  const status = input.decision === "accept" ? "accepted" : "declined";
  const pair = friendshipUsers(invitation.senderId, userId);

  try {
    if (status === "accepted") {
      await tx.friendship.create({ data: pair });
    }

    const updated = await tx.friendInvitation.update({
      where: { id: invitationId },
      data: {
        status,
        respondedAt: new Date(),
        recipientId: userId,
      },
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
  const currentUser = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true },
  });
  const invitation = await tx.groupInvitation.findUnique({
    where: { id: invitationId },
    include: { group: { select: { name: true } } },
  });

  if (!invitation || !isInvitationRecipient(invitation, userId, currentUser.email)) {
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
      data: {
        status,
        respondedAt: new Date(),
        recipientId: userId,
      },
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
