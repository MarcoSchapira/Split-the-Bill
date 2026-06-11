import { prismaAdmin } from "../db/prisma";
import { createActivity } from "../activity/activity.service";

export async function claimPendingInvitations(userId: string, email: string): Promise<void> {
  await prismaAdmin.$transaction(async (tx) => {
    const friendInvites = await tx.friendInvitation.findMany({
      where: {
        recipientEmail: email,
        recipientId: null,
        status: "pending",
      },
    });

    for (const invitation of friendInvites) {
      await tx.friendInvitation.update({
        where: { id: invitation.id },
        data: { recipientId: userId },
      });
      await createActivity(tx, {
        actorId: invitation.senderId,
        recipientIds: [userId],
        friendInvitationId: invitation.id,
        type: "FRIEND_INVITATION_SENT",
        message: "sent a friend invitation.",
      });
    }

    const groupInvites = await tx.groupInvitation.findMany({
      where: {
        recipientEmail: email,
        recipientId: null,
        status: "pending",
      },
      include: { group: { select: { name: true } } },
    });

    for (const invitation of groupInvites) {
      await tx.groupInvitation.update({
        where: { id: invitation.id },
        data: { recipientId: userId },
      });
      await createActivity(tx, {
        actorId: invitation.senderId,
        recipientIds: [userId],
        groupInvitationId: invitation.id,
        type: "GROUP_INVITATION_SENT",
        message: `sent an invitation to join ${invitation.group.name}.`,
      });
    }
  });
}
