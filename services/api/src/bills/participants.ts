import type { PrismaTransaction } from "../db/userContext";
import { ApiError } from "../http/errors";
import { getGroupMemberIds } from "../groups/group-access";

export async function assertParticipantsAllowed(
  tx: PrismaTransaction,
  actingUserId: string,
  participantIds: string[],
  options: { isSplitWithGroup?: boolean } = {},
) {
  const unique = [...new Set(participantIds)];

  if (!unique.includes(actingUserId)) {
    throw new ApiError(400, "INVALID_PARTICIPANTS", "You must be included as a participant");
  }

  if (options.isSplitWithGroup) {
    return;
  }

  for (const participantId of unique) {
    if (participantId === actingUserId) {
      continue;
    }

    const friendship = await tx.friendship.findFirst({
      where: {
        OR: [
          { userAId: actingUserId, userBId: participantId },
          { userAId: participantId, userBId: actingUserId },
        ],
      },
      select: { id: true },
    });

    if (friendship) {
      continue;
    }
    throw new ApiError(403, "PARTICIPANT_NOT_ALLOWED", "All participants must be your friends");
  }
}

export async function assertGroupBillAllowed(
  tx: PrismaTransaction,
  actingUserId: string,
  groupId: string,
) {
  const memberIds = await getGroupMemberIds(tx, groupId);

  if (!memberIds.includes(actingUserId)) {
    throw new ApiError(403, "GROUP_FORBIDDEN", "You are not a member of this group");
  }

  if (memberIds.length < 2) {
    throw new ApiError(
      400,
      "GROUP_TOO_SMALL",
      "Group bills require at least two group members",
    );
  }

  return memberIds;
}

export function sortedParticipantKey(participantIds: string[]): string[] {
  return [...new Set(participantIds)].sort();
}

export function billsSharedBetween(userId: string, friendUserId: string) {
  return {
    deletedAt: null,
    shares: { some: { userId } },
    AND: [{ shares: { some: { userId: friendUserId } } }],
  };
}
