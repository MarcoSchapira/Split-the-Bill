import type { PrismaTransaction } from "../db/userContext";
import { safeUserSelect } from "../auth/auth.types";
import { ApiError } from "../http/errors";
import { createActivity } from "../activity/activity.service";
import { buildSharesFromInput } from "./bill-split";
import { toBillShareBalanceLike, userSummaryForBill } from "./bill-balance";
import { pairwiseSummaryForBill } from "./bill-pairwise";
import type { BillInput, BillListQuery } from "./bill.types";
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
    payerMarkedAsPaid: boolean;
    lenderConfirmedPaid: boolean;
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
  existingParticipantIds?: string[],
): Promise<ResolvedBillContext> {
  const isSplitWithGroup = input.isSplitWithGroup ?? false;
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
    if (!input.groupId) {
      throw new ApiError(400, "INVALID_GROUP", "groupId is required for group bills");
    }

    groupId = input.groupId;
    participantIds = await assertGroupBillAllowed(tx, actingUserId, groupId);

    if (input.participantIds && input.participantIds.length > 0) {
      const requested = sortedParticipantKey(input.participantIds);
      if (requested.join(",") !== participantIds.join(",")) {
        throw new ApiError(
          400,
          "INVALID_PARTICIPANTS",
          "Group bills must include all current group members",
        );
      }
    }
  } else {
    participantIds = resolveParticipantIds(actingUserId, normalizedInput, existingParticipantIds);
    await assertParticipantsAllowed(tx, actingUserId, participantIds, {
      isSplitWithGroup: false,
    });
  }

  const payerId = resolvePayerId(normalizedInput, actingUserId, participantIds);
  const modeFlags = resolveBillModeFlags(normalizedInput, participantIds, isSplitWithGroup, groupId);

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
): ResolvedBillModeFlags {
  const hasLineItems = input.lineItems.length > 0;
  const hasLineItemAssignments = input.lineItems.some(
    (item) => item.assignedUserIds.length > 0,
  );
  const isOneMainTotal = input.isOneMainTotal ?? !hasLineItems;
  const isSplitWithFriends = isSplitWithGroup
    ? true
    : (input.isSplitWithFriends ?? participantIds.length > 1);
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
  const { participantIds, payerId, modeFlags, sharesInput, lineItemsInput } =
    await resolveBillContext(tx, actingUserId, input);
  const incurredAt = defaultIncurredAt(input);
  const shares = buildSharesFromInput(input.totalCents, participantIds, sharesInput);
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
  const bill = await findVisibleBill(tx, actingUserId, billId);
  const existingParticipantIds = bill.shares.map((share) => share.user.id);
  const { participantIds, payerId, modeFlags, sharesInput, lineItemsInput } =
    await resolveBillContext(tx, actingUserId, input, existingParticipantIds);
  const incurredAt = defaultIncurredAt(input);
  const shares = buildSharesFromInput(input.totalCents, participantIds, sharesInput);
  const lineItems = normalizeLineItems(lineItemsInput, participantIds, modeFlags);
  const recipientIds = [
    ...new Set([...bill.shares.map((share) => share.user.id), ...shares.map((share) => share.userId)]),
  ];

  const settledByUserId = new Map(
    bill.shares.map(
      (share) =>
        [
          share.user.id,
          { payerMarkedAsPaid: share.payerMarkedAsPaid, lenderConfirmedPaid: share.lenderConfirmedPaid },
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
