import { prisma } from "../db/prisma";
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

export async function createGroup(userId: string, input: CreateGroupInput) {
  const group = await prisma.group.create({
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

export async function listGroups(userId: string) {
  const memberships = await prisma.groupMember.findMany({
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

export async function getGroup(userId: string, groupId: string) {
  const membership = await requireGroupMember(userId, groupId);
  const group = await prisma.group.findUniqueOrThrow({
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
