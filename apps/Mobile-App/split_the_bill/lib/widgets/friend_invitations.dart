import 'package:flutter/material.dart';
import '../models/models.dart';
import '../theme/app_colors.dart';
import '../utils/format.dart';
import 'modals/add_friend_sheet.dart';

Future<void> showAddFriendSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => const AddFriendSheet(),
  );
}

class AddFriendIconButton extends StatelessWidget {
  const AddFriendIconButton({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.accentSoft,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(12),
        child: const SizedBox(
          width: 40,
          height: 40,
          child: Icon(Icons.person_add_outlined, color: AppColors.accent, size: 22),
        ),
      ),
    );
  }
}

class PendingFriendInvitationCard extends StatelessWidget {
  const PendingFriendInvitationCard({
    super.key,
    required this.invite,
    required this.onAccept,
    required this.onDecline,
  });

  final FriendInvitation invite;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      color: AppColors.pendingBg,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: AppColors.pendingText.withValues(alpha: 0.18)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  radius: 18,
                  backgroundColor: AppColors.accentSoft,
                  child: Text(
                    _initial(displayName(invite.sender)),
                    style: const TextStyle(
                      color: AppColors.accent,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        displayName(invite.sender),
                        style: const TextStyle(
                          color: AppColors.textH,
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'Wants to be friends',
                        style: TextStyle(color: AppColors.pendingText, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: onDecline,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.textH,
                      side: BorderSide(color: AppColors.pendingText.withValues(alpha: 0.25)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('Decline'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton(
                    onPressed: onAccept,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.accent,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('Accept'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class PastFriendInvitationTile extends StatelessWidget {
  const PastFriendInvitationTile({
    super.key,
    required this.title,
    required this.subtitle,
    required this.status,
    this.incoming = false,
  });

  final String title;
  final String subtitle;
  final InvitationStatus status;
  final bool incoming;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: AppColors.border),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: CircleAvatar(
          radius: 18,
          backgroundColor: AppColors.surfaceMuted,
          child: Icon(
            incoming ? Icons.mail_outline : Icons.send_outlined,
            size: 18,
            color: AppColors.text,
          ),
        ),
        title: Text(
          title,
          style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.textH),
        ),
        subtitle: Text(subtitle, style: const TextStyle(color: AppColors.text, fontSize: 13)),
        trailing: InvitationStatusChip(status: status),
      ),
    );
  }
}

class InvitationStatusChip extends StatelessWidget {
  const InvitationStatusChip({super.key, required this.status});

  final InvitationStatus status;

  @override
  Widget build(BuildContext context) {
    final (background, foreground, label) = switch (status) {
      InvitationStatus.pending => (AppColors.pendingBg, AppColors.pendingText, 'Pending'),
      InvitationStatus.accepted => (AppColors.accentSoft, AppColors.accent, 'Accepted'),
      InvitationStatus.declined => (AppColors.errorBg, AppColors.error, 'Declined'),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: foreground,
          fontWeight: FontWeight.w600,
          fontSize: 11,
        ),
      ),
    );
  }
}

String friendInvitationRecipientLabel(FriendInvitation invite) {
  return invite.recipient?.name ?? invite.recipient?.email ?? invite.recipientEmail ?? 'Unknown';
}

String _initial(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return '?';
  return trimmed[0].toUpperCase();
}
