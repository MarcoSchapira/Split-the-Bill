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
  });
}
