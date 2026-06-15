import type { PrismaTransaction } from "../db/userContext";
import { ApiError } from "../http/errors";
import { createActivity } from "../activity/activity.service";
import { withPermissions, billInclude } from "./bill.service";
import {
  computeCaptureShares,
  parseReceiptIncurredAt,
  type CaptureBillItemInput,
} from "./capture-bill-split";
import type { CaptureBillInput } from "./capture-bill.types";

async function assertParticipantsAllowed(
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

function assertPayerIsParticipant(payerId: string, participantIds: string[]) {
  if (!participantIds.includes(payerId)) {
    throw new ApiError(400, "INVALID_PAYER", "Payer must be a participant");
  }
}

export async function createCaptureBill(
  tx: PrismaTransaction,
  actingUserId: string,
  input: CaptureBillInput,
) {
  const participantIds = [...new Set(input.participantIds)];
  await assertParticipantsAllowed(tx, actingUserId, participantIds);
  assertPayerIsParticipant(input.payerId, participantIds);

  const items: CaptureBillItemInput[] = input.items;
  const { shares, totalCents } = computeCaptureShares(input.receipt, items, participantIds);
  const recipientIds = shares.map((share) => share.userId);

  const description =
    input.receipt.store_name?.trim() || "Receipt capture";
  const incurredAt = parseReceiptIncurredAt(input.receipt);

  const bill = await tx.bill.create({
    data: {
      description,
      incurredAt,
      totalCents,
      targetType: "capture",
      source: "capture",
      receiptMetadata: input.receipt,
      payerId: input.payerId,
      creatorId: actingUserId,
      shares: {
        create: shares,
      },
      lineItems: {
        create: items.map((item, index) => ({
          name: item.name,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          totalPriceCents: item.totalPriceCents,
          sortOrder: index,
          assignments: {
            create: item.assignedUserIds.map((userId) => ({ userId })),
          },
        })),
      },
    },
    include: {
      ...billInclude,
      lineItems: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          quantity: true,
          unitPriceCents: true,
          totalPriceCents: true,
          sortOrder: true,
          assignments: {
            select: {
              id: true,
              userId: true,
              user: { select: { id: true, email: true, name: true, createdAt: true } },
            },
          },
        },
      },
    },
  });

  await createActivity(tx, {
    actorId: actingUserId,
    recipientIds,
    billId: bill.id,
    type: "BILL_CREATED",
    message: `added the bill "${description}".`,
  });

  return withPermissions(bill, actingUserId);
}
