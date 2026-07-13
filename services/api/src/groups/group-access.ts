import type { PrismaTransaction } from "../db/userContext";
import { ApiError } from "../http/errors";

export async function getGroupMemberIds(tx: PrismaTransaction, groupId: string) {
  const members = await tx.groupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });

  return members.map((member) => member.userId).sort();
}

export async function assertGroupMember(
  tx: PrismaTransaction,
  groupId: string,
  userId: string,
) {
  const membership = await tx.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });

  if (!membership) {
    throw new ApiError(403, "GROUP_FORBIDDEN", "You are not a member of this group");
  }
}
