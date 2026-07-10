import type { PrismaTransaction } from "../db/userContext";
import { safeUserSelect } from "../auth/auth.types";
import { ApiError } from "../http/errors";
import { createActivity } from "../activity/activity.service";
import { buildSharesFromInput } from "./bill-split";
import { toBillShareBalanceLike, userSummaryForBill } from "./bill-balance";
import { pairwiseSummaryForBill } from "./bill-pairwise";
import type { BillInput, BillListQuery } from "./bill.types";
import { assertParticipantsAllowed, billsSharedBetween, sortedParticipantKey } from "./participants";

export const billInclude = {
  payer: { select: safeUserSelect },
  creator: { select: safeUserSelect },
  shares: {
    orderBy: { userId: "asc" as const },
    select: {
      id: true,
      shareCents: true,
      settledAt: true,
      settlementStatus: true,
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
    settledAt: Date | null;
    settlementStatus: "NOT_PAID" | "PENDING" | "PAID";
    user: { id: string; email: string; name: string | null; createdAt: Date };
  }>;
};

export function presentBill<T extends BillWithShares>(
  bill: T,
  userId: string,
  friendUserId?: string,
) {
  const shareBalance = toBillShareBalanceLike(bill.shares);
  const presented = {
    ...withPermissions(bill, userId),
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

function resolvePayerId(input: BillInput, actingUserId: string, participantIds: string[]) {
  const payerId = input.payerId ?? actingUserId;
  assertPayerIsParticipant(payerId, participantIds);
  return payerId;
}

type ResolvedBillModeFlags = {
  isOneMainTotal: boolean;
  isSplitWithFriends: boolean;
  isSplitByFinalAmounts: boolean;
};

function resolveBillModeFlags(input: BillInput, participantIds: string[]): ResolvedBillModeFlags {
  const hasLineItems = input.lineItems.length > 0;
  const hasLineItemAssignments = input.lineItems.some(
    (item) => item.assignedUserIds.length > 0,
  );
  const isOneMainTotal = input.isOneMainTotal ?? !hasLineItems;
  const isSplitWithFriends = input.isSplitWithFriends ?? participantIds.length > 1;
  const isSplitByFinalAmounts = input.isSplitByFinalAmounts ?? !hasLineItemAssignments;

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

  return {
    isOneMainTotal,
    isSplitWithFriends,
    isSplitByFinalAmounts,
  };
}

function normalizeLineItems(
  input: BillInput,
  participantIds: string[],
  modeFlags: ResolvedBillModeFlags,
) {
  const allowedParticipantIds = new Set(participantIds);

  return input.lineItems.map((item, index) => {
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
  const participantIds = resolveParticipantIds(actingUserId, input);
  await assertParticipantsAllowed(tx, actingUserId, participantIds);
  const payerId = resolvePayerId(input, actingUserId, participantIds);
  const modeFlags = resolveBillModeFlags(input, participantIds);
  const incurredAt = defaultIncurredAt(input);
  const shares = buildSharesFromInput(input.totalCents, participantIds, input.shares);
  const recipientIds = shares.map((share) => share.userId);
  const lineItems = normalizeLineItems(input, participantIds, modeFlags);

  const bill = await tx.bill.create({
    data: {
      description: input.description,
      incurredAt,
      totalCents: input.totalCents,
      source: input.source,
      isOneMainTotal: modeFlags.isOneMainTotal,
      isSplitWithFriends: modeFlags.isSplitWithFriends,
      isSplitByFinalAmounts: modeFlags.isSplitByFinalAmounts,
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
      shares: { create: shares },
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

  const whereFriend = query.friendUserId
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
  const bill = await findVisibleBill(tx, actingUserId, billId);
  const existingParticipantIds = bill.shares.map((share) => share.user.id);
  const participantIds = resolveParticipantIds(actingUserId, input, existingParticipantIds);
  await assertParticipantsAllowed(tx, actingUserId, participantIds);
  const payerId = resolvePayerId(input, actingUserId, participantIds);
  const modeFlags = resolveBillModeFlags(input, participantIds);
  const incurredAt = defaultIncurredAt(input);
  const shares = buildSharesFromInput(
    input.totalCents,
    participantIds,
    input.shares,
  );
  const lineItems = normalizeLineItems(input, participantIds, modeFlags);
  const recipientIds = [
    ...new Set([...bill.shares.map((share) => share.user.id), ...shares.map((share) => share.userId)]),
  ];

  const settledByUserId = new Map(
    bill.shares.map(
      (share) =>
        [
          share.user.id,
          { settledAt: share.settledAt, settlementStatus: share.settlementStatus },
        ] as const,
    ),
  );

  const updated = await tx.bill.update({
    where: { id: billId },
    data: {
      description: input.description,
      incurredAt,
      totalCents: input.totalCents,
      source: input.source,
      isOneMainTotal: modeFlags.isOneMainTotal,
      isSplitWithFriends: modeFlags.isSplitWithFriends,
      isSplitByFinalAmounts: modeFlags.isSplitByFinalAmounts,
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
      shares: {
        deleteMany: {},
        create: shares.map((share) => ({
          userId: share.userId,
          shareCents: share.shareCents,
          ...(settledByUserId.get(share.userId) ?? {}),
        })),
      },
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

  await tx.bill.update({ where: { id: billId }, data: { deletedAt: new Date() } });
  await createActivity(tx, {
    actorId: actingUserId,
    recipientIds: bill.shares.map((share) => share.user.id),
    billId,
    type: "BILL_DELETED",
    message: `deleted the bill "${bill.description}".`,
  });
}
