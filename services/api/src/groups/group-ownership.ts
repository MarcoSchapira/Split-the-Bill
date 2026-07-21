import type { Prisma } from "../generated/prisma/client";

export type GroupOwnershipDepartureResult =
  | { status: "not-owner" }
  | { status: "transferred"; creatorId: string }
  | { status: "deleted" };

/** Serialize membership and ownership changes for one group across instances. */
export async function lockGroupMembershipMutation(
  tx: Prisma.TransactionClient,
  groupId: string,
): Promise<void> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${`billcompass-group:${groupId}`}, 0))
  `;
}

export async function lockGroupMembershipMutations(
  tx: Prisma.TransactionClient,
  groupIds: string[],
): Promise<void> {
  for (const groupId of [...new Set(groupIds)].sort()) {
    await lockGroupMembershipMutation(tx, groupId);
  }
}

/** Prevent account deletion from racing account-owned or targeted mutations. */
export async function lockUserAccountMutation(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${`billcompass-user:${userId}`}, 0))
  `;
}

/**
 * Keeps a group manageable when its creator departs. The longest-tenured
 * remaining member becomes creator, with userId providing a deterministic
 * tie-breaker for memberships created at the same timestamp. Empty groups are
 * removed; their historical bills are retained through Bill.groupId's SET NULL
 * relation.
 */
export async function transferOrDeleteDepartingCreatorGroup(
  tx: Prisma.TransactionClient,
  groupId: string,
  departingUserId: string,
): Promise<GroupOwnershipDepartureResult> {
  await lockGroupMembershipMutation(tx, groupId);

  const group = await tx.group.findUnique({
    where: { id: groupId },
    select: { creatorId: true },
  });

  if (!group || group.creatorId !== departingUserId) {
    return { status: "not-owner" };
  }

  const nextOwner = await tx.groupMember.findFirst({
    where: {
      groupId,
      userId: { not: departingUserId },
    },
    orderBy: [{ joinedAt: "asc" }, { userId: "asc" }],
    select: { userId: true },
  });

  if (!nextOwner) {
    await tx.group.delete({ where: { id: groupId } });
    return { status: "deleted" };
  }

  // This must happen before the departing membership is deleted so the
  // current creator still satisfies the group update RLS WITH CHECK policy.
  await tx.group.update({
    where: { id: groupId },
    data: { creatorId: nextOwner.userId },
  });

  return { status: "transferred", creatorId: nextOwner.userId };
}
