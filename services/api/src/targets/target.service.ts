import type { PrismaTransaction } from "../db/userContext";
import { ApiError } from "../http/errors";
import { assertParticipantsAllowed, sortedParticipantKey } from "../bills/participants";
import { createGroupWithMembers } from "../groups/group.service";
import type { ResolveTargetInput } from "./target.types";

function memberSetsMatch(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

async function findFriendshipForPair(tx: PrismaTransaction, userAId: string, userBId: string) {
  const friendship = await tx.friendship.findFirst({
    where: {
      OR: [
        { userAId, userBId },
        { userAId: userBId, userBId: userAId },
      ],
    },
    select: { id: true },
  });

  if (!friendship) {
    throw new ApiError(403, "FRIENDSHIP_REQUIRED", "A friendship is required for two-person splits");
  }

  return friendship.id;
}

async function findExactMatchGroup(
  tx: PrismaTransaction,
  actingUserId: string,
  participantKey: string[],
) {
  const memberships = await tx.groupMember.findMany({
    where: { userId: actingUserId },
    select: { groupId: true },
  });

  for (const membership of memberships) {
    const members = await tx.groupMember.findMany({
      where: { groupId: membership.groupId },
      select: { userId: true },
      orderBy: { userId: "asc" },
    });
    const memberKey = members.map((member) => member.userId);

    if (memberSetsMatch(memberKey, participantKey)) {
      return membership.groupId;
    }
  }

  return null;
}

export async function resolveBillTarget(
  tx: PrismaTransaction,
  actingUserId: string,
  input: ResolveTargetInput,
) {
  const participantKey = sortedParticipantKey(input.participantIds);
  await assertParticipantsAllowed(tx, actingUserId, participantKey);

  if (participantKey.length === 2) {
    const [first, second] = participantKey;
    const friendshipId = await findFriendshipForPair(tx, first, second);
    return {
      targetType: "friendship" as const,
      targetId: friendshipId,
      created: false,
    };
  }

  const existingGroupId = await findExactMatchGroup(tx, actingUserId, participantKey);
  if (existingGroupId) {
    return {
      targetType: "group" as const,
      targetId: existingGroupId,
      created: false,
    };
  }

  const groupName = input.suggestedName?.trim() || "Receipt split";
  const group = await createGroupWithMembers(tx, actingUserId, {
    name: groupName,
    memberIds: participantKey,
  });

  return {
    targetType: "group" as const,
    targetId: group.id,
    created: true,
  };
}
