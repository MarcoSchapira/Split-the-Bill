import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../api/api_exception.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../../widgets/common_widgets.dart';

class InvitationsScreen extends ConsumerStatefulWidget {
  const InvitationsScreen({super.key});

  @override
  ConsumerState<InvitationsScreen> createState() => _InvitationsScreenState();
}

class _InvitationsScreenState extends ConsumerState<InvitationsScreen> {
  Invitations? _invitations;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final invitations = await ref.read(invitationsApiProvider).getInvitations();
      if (mounted) setState(() => _invitations = invitations);
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Unable to load invitations.'));
    }
  }

  Future<void> _answer(String kind, String invitationId, String decision) async {
    setState(() => _error = null);
    try {
      if (kind == 'friend') {
        await ref.read(invitationsApiProvider).answerFriendInvitation(invitationId, decision);
      } else {
        await ref.read(invitationsApiProvider).answerGroupInvitation(invitationId, decision);
      }
      notifyDataChanged(ref);
      await _load();
    } catch (e) {
      setState(() => _error = apiErrorMessage(e, 'Unable to update invitation.'));
    }
  }

  String _recipientLabel(FriendInvitation invite) {
    return invite.recipient?.name ?? invite.recipient?.email ?? invite.recipientEmail ?? 'Unknown';
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(dataRefreshProvider, (_, __) => _load());

    final invitations = _invitations;
    final receivedPending = (invitations?.receivedFriends
                .where((i) => i.status == InvitationStatus.pending)
                .length ??
            0) +
        (invitations?.receivedGroups.where((i) => i.status == InvitationStatus.pending).length ?? 0);

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.accent,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Invitations', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          const Text('Friendships and memberships activate only when accepted.'),
          const SizedBox(height: 16),
          if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
          Row(
            children: [
              const Text('Waiting for you', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const Spacer(),
              CountBadge(count: receivedPending),
            ],
          ),
          const SizedBox(height: 12),
          if (invitations == null)
            const LoadingView()
          else ...[
            ...invitations.receivedFriends
                .where((i) => i.status == InvitationStatus.pending)
                .map((invite) => _InvitationCard(
                      description: '${displayName(invite.sender)} wants to be friends.',
                      onAccept: () => _answer('friend', invite.id, 'accept'),
                      onDecline: () => _answer('friend', invite.id, 'decline'),
                    )),
            ...invitations.receivedGroups
                .where((i) => i.status == InvitationStatus.pending)
                .map((invite) => _InvitationCard(
                      description:
                          '${displayName(invite.sender)} invited you to ${invite.groupRef.name}.',
                      onAccept: () => _answer('group', invite.id, 'accept'),
                      onDecline: () => _answer('group', invite.id, 'decline'),
                    )),
            if (receivedPending == 0)
              const EmptyState(message: 'Nothing waiting for your response.'),
            const SizedBox(height: 24),
            const Text('Sent invitations', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            ...invitations.sentFriends.map((invite) => _SentCard(
                  description: 'Friend request to ${_recipientLabel(invite)}',
                  status: invite.status,
                )),
            ...invitations.sentGroups.map((invite) => _SentCard(
                  description:
                      'Group invite to ${invite.groupRef.name} (${_recipientLabel(invite)})',
                  status: invite.status,
                )),
            if (invitations.sentFriends.isEmpty && invitations.sentGroups.isEmpty)
              const EmptyState(message: 'No sent invitations yet.'),
          ],
        ],
      ),
    );
  }
}

class _InvitationCard extends StatelessWidget {
  const _InvitationCard({
    required this.description,
    required this.onAccept,
    required this.onDecline,
  });

  final String description;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: AppColors.pendingBg,
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(description, style: const TextStyle(color: AppColors.pendingText)),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(onPressed: onDecline, child: const Text('Decline')),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton(
                    onPressed: onAccept,
                    style: FilledButton.styleFrom(backgroundColor: AppColors.accent),
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

class _SentCard extends StatelessWidget {
  const _SentCard({required this.description, required this.status});

  final String description;
  final InvitationStatus status;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text(description),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: status == InvitationStatus.pending
                ? AppColors.pendingBg
                : AppColors.accentSoft,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            status.name,
            style: TextStyle(
              color: status == InvitationStatus.pending ? AppColors.pendingText : AppColors.accent,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
        ),
      ),
    );
  }
}
