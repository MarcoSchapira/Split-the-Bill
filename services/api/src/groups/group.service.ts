import type { PrismaTransaction } from "../db/userContext";
import { safeUserSelect } from "../auth/auth.types";
import { requireGroupMember } from "./group.authorization";
import type { CreateGroupInput } from "./group.types";

const memberWithUser = {
  id: true,
  role: true,
  joinedAt: true,
  user: {
    select: safeUserSelect,
  },
} as const;

export async function createGroup(tx: PrismaTransaction, userId: string, input: CreateGroupInput) {
  const group = await tx.group.create({
    data: {
      name: input.name,
      members: {
        create: {
          userId,
          role: "owner",
        },
      },
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
    },
  });

  return {
    ...group,
    role: "owner",
  };
}

export async function createGroupWithMembers(
  tx: PrismaTransaction,
  actingUserId: string,
  input: { name: string; memberIds: string[] },
) {
  const uniqueMembers = [...new Set(input.memberIds)];

  const group = await tx.group.create({
    data: {
      name: input.name,
      members: {
        create: uniqueMembers.map((memberId) => ({
          userId: memberId,
          role: memberId === actingUserId ? "owner" : "member",
        })),
      },
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
    },
  });

  return {
    ...group,
    role: "owner" as const,
  };
}

export async function listGroups(tx: PrismaTransaction, userId: string) {
  const memberships = await tx.groupMember.findMany({
    where: { userId },
    orderBy: { joinedAt: "desc" },
    select: {
      role: true,
      group: {
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      },
    },
  });

  return memberships.map((membership) => ({
    ...membership.group,
    role: membership.role,
  }));
}

export async function getGroup(tx: PrismaTransaction, userId: string, groupId: string) {
  const membership = await requireGroupMember(tx, userId, groupId);
  const group = await tx.group.findUniqueOrThrow({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      members: {
        orderBy: { joinedAt: "asc" },
        select: memberWithUser,
      },
    },
  });

  return {
    ...group,
    role: membership.role,
  };
}
