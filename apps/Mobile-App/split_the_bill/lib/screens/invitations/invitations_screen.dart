import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../api/api_exception.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/friend_invitations.dart';

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

  Future<void> _answer(String invitationId, String decision) async {
    setState(() => _error = null);
    try {
      await ref.read(invitationsApiProvider).answerFriendInvitation(invitationId, decision);
      notifyDataChanged(ref);
      await _load();
    } catch (e) {
      setState(() => _error = apiErrorMessage(e, 'Unable to update invitation.'));
    }
  }

  List<Widget> _buildInvitationList(Invitations invitations) {
    final pendingReceived = invitations.receivedFriends
        .where((invite) => invite.status == InvitationStatus.pending)
        .toList();
    final pastReceived = invitations.receivedFriends
        .where((invite) => invite.status != InvitationStatus.pending)
        .toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    final sent = [...invitations.sentFriends]
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

    final items = <Widget>[
      ...pendingReceived.map(
        (invite) => PendingFriendInvitationCard(
          invite: invite,
          onAccept: () => _answer(invite.id, 'accept'),
          onDecline: () => _answer(invite.id, 'decline'),
        ),
      ),
      ...sent.map(
        (invite) => PastFriendInvitationTile(
          title: 'Sent to ${friendInvitationRecipientLabel(invite)}',
          subtitle: 'Friend request',
          status: invite.status,
        ),
      ),
      ...pastReceived.map(
        (invite) => PastFriendInvitationTile(
          title: displayName(invite.sender),
          subtitle: 'Incoming friend request',
          status: invite.status,
          incoming: true,
        ),
      ),
    ];

    if (items.isEmpty) {
      return [
        Card(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: const BorderSide(color: AppColors.border),
          ),
          child: const Padding(
            padding: EdgeInsets.all(24),
            child: EmptyState(message: 'No invitations yet.'),
          ),
        ),
      ];
    }

    return items;
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(dataRefreshProvider, (_, __) => _load());

    final invitations = _invitations;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Invitations'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: AddFriendIconButton(onPressed: () => showAddFriendSheet(context)),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.accent,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text(
              'Open and past friend invitations.',
              style: TextStyle(color: AppColors.text, height: 1.4),
            ),
            const SizedBox(height: 16),
            if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
            if (invitations == null) const LoadingView() else ..._buildInvitationList(invitations),
          ],
        ),
      ),
    );
  }
}
