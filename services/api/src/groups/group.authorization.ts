import type { PrismaTransaction } from "../db/userContext";
import { ApiError } from "../http/errors";

type MembershipAuthorization = {
  role: string;
};

export async function requireGroupMember(
  tx: PrismaTransaction,
  userId: string,
  groupId: string,
): Promise<MembershipAuthorization> {
  const group = await tx.group.findUnique({
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
