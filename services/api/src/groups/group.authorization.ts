import { prisma } from "../db/prisma";
import { ApiError } from "../http/errors";

type MembershipAuthorization = {
  role: string;
};

export async function requireGroupMember(
  userId: string,
  groupId: string,
): Promise<MembershipAuthorization> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      members: {
        where: { userId },
        select: { role: true },
      },
    },
  });

  if (!group) {
    throw new ApiError(404, "GROUP_NOT_FOUND", "Group not found");
  }

  const membership = group.members[0];

  if (!membership) {
    throw new ApiError(403, "GROUP_ACCESS_FORBIDDEN", "You are not a member of this group");
  }

  return membership;
}

export async function requireGroupOwner(
  userId: string,
  groupId: string,
): Promise<void> {
  const membership = await requireGroupMember(userId, groupId);

  if (membership.role !== "owner") {
    throw new ApiError(403, "GROUP_OWNER_REQUIRED", "Only the group owner can add members");
  }
}
