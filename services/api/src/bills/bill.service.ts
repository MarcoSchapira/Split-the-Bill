import type { PrismaTransaction } from "../db/userContext";
import { safeUserSelect } from "../auth/auth.types";
import { ApiError } from "../http/errors";
import { createActivity } from "../activity/activity.service";
import { buildSharesFromInput, sharesWithLenderId } from "./bill-split";
import { toBillShareBalanceLike, userSummaryForBill } from "./bill-balance";
import { pairwiseSummaryForBill } from "./bill-pairwise";
import type { BillInput, BillListQuery } from "./bill.types";
import { lockGroupMembershipMutations } from "../groups/group-ownership";
import {
  assertGroupBillAllowed,
  assertParticipantsAllowed,
  billsSharedBetween,
  sortedParticipantKey,
} from "./participants";

const groupSelect = {
  id: true,
  name: true,
  iconKey: true,
} as const;

export const billInclude = {
  payer: { select: safeUserSelect },
  creator: { select: safeUserSelect },
  group: { select: groupSelect },
  shares: {
    orderBy: { userId: "asc" as const },
    select: {
      id: true,
      shareCents: true,
      lenderId: true,
      payerMarkedAsPaid: true,
      lenderConfirmedPaid: true,
      user: { select: safeUserSelect },
    },
  },
  lineItems: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      name: true,
      quantity: true,
      unitPriceCents: true,
      totalPriceCents: true,
      sortOrder: true,
      assignments: {
        orderBy: { userId: "asc" as const },
        select: {
          id: true,
          user: { select: safeUserSelect },
        },
      },
    },
  },
} as const;

export function withPermissions<T extends { creatorId: string }>(bill: T, userId: string) {
  return {
    ...bill,
    canEdit: true,
    canDelete: true,
    canRetarget: bill.creatorId === userId,
  };
}

type BillWithShares = {
  payerId: string;
  creatorId: string;
  shares: Array<{
    id: string;
    shareCents: number;
    lenderId: string;
    payerMarkedAsPaid: boolean;
    lenderConfirmedPaid: boolean;
    user: { id: string; email: string; name: string | null; createdAt: Date };
  }>;
};

type BillLineItemLike = {
  quantity: unknown;
};

function presentLineItems<T extends BillLineItemLike>(lineItems: T[]) {
  return lineItems.map((item) => ({
    ...item,
    // Prisma Decimal serializes as a string over JSON; expose a real number to clients.
    quantity: Number(item.quantity),
  }));
}

export function presentBill<T extends BillWithShares>(
  bill: T,
  userId: string,
  friendUserId?: string,
) {
  const shareBalance = toBillShareBalanceLike(bill.shares);
  const billWithItems = bill as T & { lineItems?: BillLineItemLike[] };
  const presented = {
    ...withPermissions(bill, userId),
    ...(billWithItems.lineItems
      ? { lineItems: presentLineItems(billWithItems.lineItems) }
      : {}),
    userSummary: userSummaryForBill(
      { payerId: bill.payerId, shares: shareBalance },
      userId,
      friendUserId,
    ),
  };

  if (!friendUserId) {
    return presented;
  }

  const pairwise = pairwiseSummaryForBill(
    { payerId: bill.payerId, shares: shareBalance },
    userId,
    friendUserId,
  );

  return pairwise ? { ...presented, pairwise } : presented;
}

function assertPayerIsParticipant(payerId: string, participantIds: string[]) {
  if (!participantIds.includes(payerId)) {
    throw new ApiError(400, "INVALID_PAYER", "Payer must be a participant in this bill");
  }
}

function resolveParticipantIds(
  actingUserId: string,
  input: BillInput,
  existingParticipantIds?: string[],
) {
  if (input.participantIds && input.participantIds.length > 0) {
    return sortedParticipantKey(input.participantIds);
  }

  if (existingParticipantIds && existingParticipantIds.length > 0) {
    return sortedParticipantKey(existingParticipantIds);
  }

  return sortedParticipantKey([actingUserId]);
}

function defaultIncurredAt(input: BillInput) {
  if (input.incurredAt) {
    return input.incurredAt;
  }

  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function resolvePayerId(input: BillInput, fallbackPayerId: string, participantIds: string[]) {
  const payerId = input.payerId ?? fallbackPayerId;
  assertPayerIsParticipant(payerId, participantIds);
  return payerId;
}

type ResolvedBillModeFlags = {
  isOneMainTotal: boolean;
  isSplitWithFriends: boolean;
  isSplitWithGroup: boolean;
  isSplitByFinalAmounts: boolean;
  groupId: string | null;
};

type ResolvedBillContext = {
  participantIds: string[];
  payerId: string;
  modeFlags: ResolvedBillModeFlags;
  sharesInput: BillInput["shares"];
  lineItemsInput: BillInput["lineItems"];
};

type ExistingBillTarget = {
  creatorId: string;
  payerId: string;
  participantIds: string[];
  isSplitWithFriends: boolean;
  isSplitWithGroup: boolean;
  groupId: string | null;
};

function sameParticipantIds(first: string[], second: string[]) {
  const firstKey = sortedParticipantKey(first);
  const secondKey = sortedParticipantKey(second);
  return (
    firstKey.length === secondKey.length &&
    firstKey.every((id, index) => id === secondKey[index])
  );
}

function normalizedRequestedTarget(input: BillInput, existing: ExistingBillTarget) {
  const participantIds = input.participantIds?.length
    ? sortedParticipantKey(input.participantIds)
    : sortedParticipantKey(existing.participantIds);
  const isSplitWithGroup = input.isSplitWithGroup ?? existing.isSplitWithGroup;

  return {
    participantIds,
    payerId: input.payerId ?? existing.payerId,
    isSplitWithFriends: input.isSplitWithFriends ?? existing.isSplitWithFriends,
    isSplitWithGroup,
    groupId: isSplitWithGroup
      ? (input.groupId !== undefined ? input.groupId : existing.groupId)
      : null,
  };
}

function assertRetargetAllowed(
  actingUserId: string,
  input: BillInput,
  existing: ExistingBillTarget,
) {
  if (existing.creatorId === actingUserId) {
    return;
  }

  const requested = normalizedRequestedTarget(input, existing);
  const targetChanged =
    !sameParticipantIds(requested.participantIds, existing.participantIds) ||
    requested.payerId !== existing.payerId ||
    requested.isSplitWithFriends !== existing.isSplitWithFriends ||
    requested.isSplitWithGroup !== existing.isSplitWithGroup ||
    requested.groupId !== existing.groupId;

  if (targetChanged) {
    throw new ApiError(
      403,
      "BILL_RETARGET_FORBIDDEN",
      "Only the bill creator can change its payer, participants, or target",
    );
  }
}

function stripLineItemAssignments(input: BillInput): BillInput["lineItems"] {
  return input.lineItems.map((item) => ({
    ...item,
    assignedUserIds: [],
  }));
}

async function resolveBillContext(
  tx: PrismaTransaction,
  actingUserId: string,
  input: BillInput,
  existing?: ExistingBillTarget,
): Promise<ResolvedBillContext> {
  const isSplitWithGroup = input.isSplitWithGroup ?? existing?.isSplitWithGroup ?? false;
  const normalizedInput = isSplitWithGroup
    ? {
        ...input,
        lineItems: stripLineItemAssignments(input),
        shares: undefined,
        isSplitByFinalAmounts: true,
        isSplitWithFriends: true,
      }
    : input;

  let participantIds: string[];
  let groupId: string | null = null;

  if (isSplitWithGroup) {
    groupId = input.groupId !== undefined ? input.groupId : existing?.groupId ?? null;
    const isUnchangedGroup = existing?.isSplitWithGroup === true && existing.groupId === groupId;

    if (!groupId && !isUnchangedGroup) {
      throw new ApiError(400, "INVALID_GROUP", "groupId is required for group bills");
    }

    const requested = input.participantIds?.length
      ? sortedParticipantKey(input.participantIds)
      : null;

    if (
      isUnchangedGroup &&
      (!requested || sameParticipantIds(requested, existing.participantIds))
    ) {
      // Membership changes only affect future group bills. Editing an existing
      // group bill must keep its historical participant snapshot unless the
      // creator explicitly submits the current member set as a retarget.
      participantIds = sortedParticipantKey(existing.participantIds);
    } else {
      if (!groupId) {
        throw new ApiError(
          400,
          "INVALID_GROUP",
          "A bill whose group was deleted cannot be retargeted as a group bill",
        );
      }
      const currentMemberIds = await assertGroupBillAllowed(tx, actingUserId, groupId);
      participantIds = currentMemberIds;

      if (requested && !sameParticipantIds(requested, currentMemberIds)) {
        throw new ApiError(
          400,
          "INVALID_PARTICIPANTS",
          "Group bills must include all current group members",
        );
      }
    }
  } else {
    participantIds = resolveParticipantIds(
      actingUserId,
      normalizedInput,
      existing?.participantIds,
    );
    const isUnchangedParticipantSet =
      existing != null &&
      !existing.isSplitWithGroup &&
      sameParticipantIds(participantIds, existing.participantIds);

    // Historical direct bills remain editable after a friendship is removed.
    // Only a real participant retarget needs current friendship validation.
    if (!isUnchangedParticipantSet) {
      await assertParticipantsAllowed(tx, actingUserId, participantIds, {
        isSplitWithGroup: false,
      });
    }
  }

  const payerId = resolvePayerId(
    normalizedInput,
    existing?.payerId ?? actingUserId,
    participantIds,
  );
  const modeFlags = resolveBillModeFlags(
    normalizedInput,
    participantIds,
    isSplitWithGroup,
    groupId,
    existing,
  );

  return {
    participantIds,
    payerId,
    modeFlags,
    sharesInput: isSplitWithGroup ? undefined : normalizedInput.shares,
    lineItemsInput: normalizedInput.lineItems,
  };
}

function resolveBillModeFlags(
  input: BillInput,
  participantIds: string[],
  isSplitWithGroup: boolean,
  groupId: string | null,
  existing?: ExistingBillTarget,
): ResolvedBillModeFlags {
  const hasLineItems = input.lineItems.length > 0;
  const hasLineItemAssignments = input.lineItems.some(
    (item) => (item.assignedUserIds?.length ?? 0) > 0,
  );
  const isOneMainTotal = input.isOneMainTotal ?? !hasLineItems;
  const targetParticipantsUnchanged =
    existing != null &&
    existing.isSplitWithGroup === isSplitWithGroup &&
    sameParticipantIds(participantIds, existing.participantIds);
  const isSplitWithFriends = isSplitWithGroup
    ? true
    : (input.isSplitWithFriends ??
      (targetParticipantsUnchanged ? existing.isSplitWithFriends : participantIds.length > 1));
  const isSplitByFinalAmounts = isSplitWithGroup
    ? true
    : (input.isSplitByFinalAmounts ?? !hasLineItemAssignments);

  if (isSplitWithGroup && hasLineItemAssignments) {
    throw new ApiError(
      400,
      "INVALID_SPLIT_MODE",
      "Group bills cannot include line-item assignments",
    );
  }

  if (isSplitWithFriends && participantIds.length <= 1) {
    throw new ApiError(
      400,
      "INVALID_SPLIT_MODE",
      "Split-with-friends bills must include more than one participant",
    );
  }

  if (!isSplitWithFriends && participantIds.length > 1) {
    throw new ApiError(
      400,
      "INVALID_SPLIT_MODE",
      "Solo bills cannot include multiple participants",
    );
  }

  if (isOneMainTotal && !isSplitByFinalAmounts) {
    throw new ApiError(
      400,
      "INVALID_SPLIT_MODE",
      "One-main-total bills cannot split by line-item assignments",
    );
  }

  if (!isSplitByFinalAmounts && !hasLineItems) {
    throw new ApiError(
      400,
      "INVALID_SPLIT_MODE",
      "Line-item assignment split requires line items",
    );
  }

  if (isOneMainTotal && hasLineItemAssignments) {
    throw new ApiError(
      400,
      "INVALID_SPLIT_MODE",
      "One-main-total bills cannot include line-item assignments",
    );
  }

  if (isSplitWithGroup && input.shares) {
    throw new ApiError(
      400,
      "INVALID_SHARES",
      "Group bills must use an even split across all group members",
    );
  }

  return {
    isOneMainTotal,
    isSplitWithFriends,
    isSplitWithGroup,
    isSplitByFinalAmounts,
    groupId,
  };
}

function normalizeLineItems(
  lineItems: BillInput["lineItems"],
  participantIds: string[],
  modeFlags: ResolvedBillModeFlags,
) {
  const allowedParticipantIds = new Set(participantIds);

  return lineItems.map((item, index) => {
    const assignedUserIds = sortedParticipantKey(item.assignedUserIds);

    if (modeFlags.isOneMainTotal && assignedUserIds.length > 0) {
      throw new ApiError(
        400,
        "INVALID_LINE_ITEM_ASSIGNMENTS",
        "One-main-total bills cannot include line-item assignments",
      );
    }

    if (!modeFlags.isSplitByFinalAmounts && assignedUserIds.length === 0) {
      throw new ApiError(400, "INVALID_LINE_ITEM_ASSIGNMENTS", "Each item must have assignees");
    }

    for (const assignedUserId of assignedUserIds) {
      if (!allowedParticipantIds.has(assignedUserId)) {
        throw new ApiError(
          400,
          "INVALID_LINE_ITEM_ASSIGNMENTS",
          "Line-item assignees must be bill participants",
        );
      }
    }

    return {
      name: item.name,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      totalPriceCents: item.totalPriceCents,
      sortOrder: index,
      assignments: {
        create: assignedUserIds.map((userId) => ({ userId })),
      },
    };
  });
}

export async function findVisibleBill(tx: PrismaTransaction, userId: string, billId: string) {
  const bill = await tx.bill.findFirst({
    where: {
      id: billId,
      deletedAt: null,
      shares: { some: { userId } },
    },
    include: billInclude,
  });

  if (!bill) {
    throw new ApiError(404, "BILL_NOT_FOUND", "Bill not found");
  }

  return bill;
}

export async function createBill(tx: PrismaTransaction, actingUserId: string, input: BillInput) {
  if (input.isSplitWithGroup && input.groupId) {
    await lockGroupMembershipMutations(tx, [input.groupId]);
  }

  const { participantIds, payerId, modeFlags, sharesInput, lineItemsInput } =
    await resolveBillContext(tx, actingUserId, input);
  const incurredAt = defaultIncurredAt(input);
  const shares = buildSharesFromInput(
    input.totalCents,
    participantIds,
    sharesInput,
    payerId,
  );
  const recipientIds = shares.map((share) => share.userId);
  const lineItems = normalizeLineItems(lineItemsInput, participantIds, modeFlags);

  const bill = await tx.bill.create({
    data: {
      description: input.description,
      incurredAt,
      totalCents: input.totalCents,
      source: input.source,
      isOneMainTotal: modeFlags.isOneMainTotal,
      isSplitWithFriends: modeFlags.isSplitWithFriends,
      isSplitWithGroup: modeFlags.isSplitWithGroup,
      isSplitByFinalAmounts: modeFlags.isSplitByFinalAmounts,
      groupId: modeFlags.groupId,
      storeName: input.storeName,
      storeAddress: input.storeAddress,
      receiptNumber: input.receiptNumber,
      receiptDate: input.receiptDate,
      receiptTime: input.receiptTime,
      paymentMethod: input.paymentMethod,
      cardLast4: input.cardLast4,
      itemCount: input.itemCount,
      subtotalCents: input.subtotalCents,
      otherFeesCents: input.otherFeesCents,
      taxCents: input.taxCents,
      tipCents: input.tipCents,
      payerId,
      creatorId: actingUserId,
      shares: { create: sharesWithLenderId(shares, payerId) },
      lineItems: { create: lineItems },
    },
    include: billInclude,
  });
  await createActivity(tx, {
    actorId: actingUserId,
    recipientIds,
    billId: bill.id,
    type: "BILL_CREATED",
    message: `added the bill "${input.description}".`,
  });
  return presentBill(bill, actingUserId);
}

export async function listBills(
  tx: PrismaTransaction,
  userId: string,
  query: BillListQuery = {},
) {
  const whereParticipant = query.participantId
    ? { shares: { some: { userId: query.participantId } } }
    : {};

  const whereFriend = query.groupId
    ? {
        deletedAt: null,
        groupId: query.groupId,
        isSplitWithGroup: true,
        shares: { some: { userId } },
      }
    : query.friendUserId
      ? billsSharedBetween(userId, query.friendUserId)
      : { deletedAt: null, shares: { some: { userId } } };

  const bills = await tx.bill.findMany({
    where: {
      ...whereFriend,
      ...whereParticipant,
    },
    orderBy: [{ incurredAt: "desc" }, { createdAt: "desc" }],
    include: billInclude,
  });

  return bills.map((bill) => presentBill(bill, userId));
}

export async function getBill(tx: PrismaTransaction, userId: string, billId: string) {
  const bill = await findVisibleBill(tx, userId, billId);
  return presentBill(bill, userId);
}

export async function updateBill(
  tx: PrismaTransaction,
  actingUserId: string,
  billId: string,
  input: BillInput,
) {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${`billcompass-bill:${billId}`}, 0))
  `;
  const bill = await findVisibleBill(tx, actingUserId, billId);
  const requestedUsesGroup = input.isSplitWithGroup ?? bill.isSplitWithGroup;
  const requestedGroupId = requestedUsesGroup
    ? (input.groupId !== undefined ? input.groupId : bill.groupId)
    : null;
  await lockGroupMembershipMutations(
    tx,
    [bill.groupId, requestedGroupId].filter((groupId): groupId is string => groupId !== null),
  );
  const existingTarget: ExistingBillTarget = {
    creatorId: bill.creatorId,
    payerId: bill.payerId,
    participantIds: bill.shares.map((share) => share.user.id),
    isSplitWithFriends: bill.isSplitWithFriends,
    isSplitWithGroup: bill.isSplitWithGroup,
    groupId: bill.groupId,
  };
  assertRetargetAllowed(actingUserId, input, existingTarget);
  const { participantIds, payerId, modeFlags, sharesInput, lineItemsInput } =
    await resolveBillContext(tx, actingUserId, input, existingTarget);
  const incurredAt = defaultIncurredAt(input);
  const participantSetUnchanged = sameParticipantIds(
    participantIds,
    existingTarget.participantIds,
  );
  const preserveImplicitShares =
    sharesInput === undefined &&
    participantSetUnchanged &&
    input.totalCents === bill.totalCents &&
    payerId === bill.payerId;
  const shares = preserveImplicitShares
    ? bill.shares.map((share) => ({
        userId: share.user.id,
        shareCents: share.shareCents,
      }))
    : buildSharesFromInput(
        input.totalCents,
        participantIds,
        sharesInput,
        payerId,
      );
  const lineItems = normalizeLineItems(lineItemsInput, participantIds, modeFlags);
  const recipientIds = [
    ...new Set([...bill.shares.map((share) => share.user.id), ...shares.map((share) => share.userId)]),
  ];

  const settledByUserId = new Map(
    bill.shares.map(
      (share) =>
        [
          share.user.id,
          {
            payerMarkedAsPaid: share.payerMarkedAsPaid,
            lenderConfirmedPaid: share.lenderConfirmedPaid,
          },
        ] as const,
    ),
  );
  const existingShareByUserId = new Map(
    bill.shares.map((share) => [share.user.id, share] as const),
  );

  let shareUpdate:
    | {
        update: Array<{
          where: { id: string };
          data: { shareCents: number; lenderId: string };
        }>;
      }
    | {
        deleteMany: Record<string, never>;
        create: Array<{
          userId: string;
          shareCents: number;
          lenderId: string;
          payerMarkedAsPaid?: boolean;
          lenderConfirmedPaid?: boolean;
        }>;
      };

  if (participantSetUnchanged) {
    const updates: Array<{
      where: { id: string };
      data: { shareCents: number; lenderId: string };
    }> = [];
    let canUpdateInPlace = true;
    for (const share of shares) {
      const existing = existingShareByUserId.get(share.userId);
      if (!existing) {
        canUpdateInPlace = false;
        break;
      }
      updates.push({
        where: { id: existing.id },
        data: {
          shareCents: share.shareCents,
          lenderId: payerId,
        },
      });
    }
    shareUpdate = canUpdateInPlace
      ? { update: updates }
      : {
          deleteMany: {},
          create: shares.map((share) => ({
            userId: share.userId,
            shareCents: share.shareCents,
            lenderId: payerId,
            ...(settledByUserId.get(share.userId) ?? {}),
          })),
        };
  } else {
    shareUpdate = {
      deleteMany: {},
      create: shares.map((share) => ({
        userId: share.userId,
        shareCents: share.shareCents,
        lenderId: payerId,
        ...(settledByUserId.get(share.userId) ?? {}),
      })),
    };
  }

  const updated = await tx.bill.update({
    where: { id: billId },
    data: {
      description: input.description,
      incurredAt,
      totalCents: input.totalCents,
      source: input.source,
      isOneMainTotal: modeFlags.isOneMainTotal,
      isSplitWithFriends: modeFlags.isSplitWithFriends,
      isSplitWithGroup: modeFlags.isSplitWithGroup,
      isSplitByFinalAmounts: modeFlags.isSplitByFinalAmounts,
      groupId: modeFlags.groupId,
      storeName: input.storeName,
      storeAddress: input.storeAddress,
      receiptNumber: input.receiptNumber,
      receiptDate: input.receiptDate,
      receiptTime: input.receiptTime,
      paymentMethod: input.paymentMethod,
      cardLast4: input.cardLast4,
      itemCount: input.itemCount,
      subtotalCents: input.subtotalCents,
      otherFeesCents: input.otherFeesCents,
      taxCents: input.taxCents,
      tipCents: input.tipCents,
      payerId,
      shares: shareUpdate,
      lineItems: {
        deleteMany: {},
        create: lineItems,
      },
    },
    include: billInclude,
  });
  await createActivity(tx, {
    actorId: actingUserId,
    recipientIds,
    billId,
    type: "BILL_UPDATED",
    message: `updated the bill "${input.description}".`,
  });
  return presentBill(updated, actingUserId);
}

export async function deleteBill(tx: PrismaTransaction, actingUserId: string, billId: string) {
  const bill = await findVisibleBill(tx, actingUserId, billId);
  const recipientIds = bill.shares.map((share) => share.user.id);
  const incurredDate = bill.incurredAt.toISOString().slice(0, 10);
  const amount = (bill.totalCents / 100).toFixed(2);

  // Omit billId so this event survives the cascade when the bill row is removed.
  await createActivity(tx, {
    actorId: actingUserId,
    recipientIds,
    type: "BILL_DELETED",
    message: `deleted the bill "${bill.description}" on ${incurredDate} ($${amount}).`,
  });
  await tx.bill.delete({ where: { id: billId } });
}
