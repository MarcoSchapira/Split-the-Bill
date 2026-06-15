import type { PrismaTransaction } from "../db/userContext";
import { ApiError } from "../http/errors";

export async function assertParticipantsAllowed(
  tx: PrismaTransaction,
  actingUserId: string,
  participantIds: string[],
) {
  const unique = [...new Set(participantIds)];

  if (!unique.includes(actingUserId)) {
    throw new ApiError(400, "INVALID_PARTICIPANTS", "You must be included as a participant");
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

    const sharedGroup = await tx.groupMember.findFirst({
      where: {
        userId: participantId,
        group: { members: { some: { userId: actingUserId } } },
      },
      select: { id: true },
    });

    if (!sharedGroup) {
      throw new ApiError(
        403,
        "PARTICIPANT_NOT_ALLOWED",
        "All participants must be your friends or group members",
      );
    }
  }
}

export function sortedParticipantKey(participantIds: string[]): string[] {
  return [...new Set(participantIds)].sort();
}
