import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../api/api_exception.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../../widgets/bill_list/bill_list.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/friend_invitations.dart';

class FriendsScreen extends ConsumerStatefulWidget {
  const FriendsScreen({super.key});

  @override
  ConsumerState<FriendsScreen> createState() => _FriendsScreenState();
}

class _FriendsScreenState extends ConsumerState<FriendsScreen> {
  List<FriendshipSummary> _friends = [];
  Invitations? _invitations;
  Dashboard? _dashboard;
  String? _error;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _error = null;
      _isLoading = true;
    });

    try {
      final results = await Future.wait([
        ref.read(friendsApiProvider).listFriends(),
        ref.read(dashboardApiProvider).getDashboard(),
        ref.read(invitationsApiProvider).getInvitations(),
      ]);
      if (mounted) {
        setState(() {
          _friends = results[0] as List<FriendshipSummary>;
          _dashboard = results[1] as Dashboard;
          _invitations = results[2] as Invitations;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Unable to load friends.'));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  int? _balanceFor(String friendshipId) {
    final balance = _dashboard?.balances.where((b) => b.friendshipId == friendshipId).firstOrNull;
    return balance?.balanceCents;
  }

  Future<void> _answerInvitation(String invitationId, String decision) async {
    setState(() => _error = null);
    try {
      await ref.read(invitationsApiProvider).answerFriendInvitation(invitationId, decision);
      notifyDataChanged(ref);
      await _load();
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Unable to update invitation.'));
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(dataRefreshProvider, (_, __) => _load());

    if (_isLoading && _friends.isEmpty) {
      return const LoadingView(message: 'Loading friends...');
    }

    final invitations = _invitations;
    final pendingReceived = invitations?.receivedFriends
            .where((invite) => invite.status == InvitationStatus.pending)
            .toList() ??
        const <FriendInvitation>[];

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.accent,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Friends',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.textH),
                ),
              ),
              AddFriendIconButton(onPressed: () => showAddFriendSheet(context)),
            ],
          ),
          const SizedBox(height: 16),
          if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
          if (_friends.isEmpty)
            Card(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: const BorderSide(color: AppColors.border),
              ),
              child: const Padding(
                padding: EdgeInsets.all(20),
                child: EmptyState(message: 'No friends yet. Tap + to send an invitation.'),
              ),
            )
          else
            ..._friends.map((friendship) {
              final cents = _balanceFor(friendship.id);
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                  side: const BorderSide(color: AppColors.border),
                ),
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  title: Text(
                    displayName(friendship.friend),
                    style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.textH),
                  ),
                  subtitle: Text(
                    friendship.friend.email,
                    style: const TextStyle(color: AppColors.text, fontSize: 13),
                  ),
                  trailing: cents != null ? BalanceChip(cents: cents) : null,
                  onTap: () => context.push('/friends/${friendship.id}'),
                ),
              );
            }),
          const SizedBox(height: 24),
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () => context.push('/friends/invites'),
              borderRadius: BorderRadius.circular(10),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    const Text(
                      'Invitations',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textH),
                    ),
                    const Spacer(),
                    CountBadge(count: pendingReceived.length),
                    const SizedBox(width: 6),
                    const Icon(Icons.chevron_right, color: AppColors.text, size: 22),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          if (invitations == null)
            const LoadingView()
          else if (pendingReceived.isEmpty)
            Card(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: const BorderSide(color: AppColors.border),
              ),
              child: ListTile(
                title: const Text(
                  'No open invitations',
                  style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textH),
                ),
                subtitle: const Text(
                  'View sent and past invitations',
                  style: TextStyle(color: AppColors.text, fontSize: 13),
                ),
                trailing: const Icon(Icons.chevron_right, color: AppColors.text),
                onTap: () => context.push('/friends/invites'),
              ),
            )
          else
            ...pendingReceived.map(
              (invite) => PendingFriendInvitationCard(
                invite: invite,
                onAccept: () => _answerInvitation(invite.id, 'accept'),
                onDecline: () => _answerInvitation(invite.id, 'decline'),
              ),
            ),
        ],
      ),
    );
  }
}

class FriendDetailScreen extends ConsumerStatefulWidget {
  const FriendDetailScreen({super.key, required this.friendshipId});

  final String friendshipId;

  @override
  ConsumerState<FriendDetailScreen> createState() => _FriendDetailScreenState();
}

class _FriendDetailScreenState extends ConsumerState<FriendDetailScreen> {
  FriendshipDetail? _friendship;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final friendship =
          await ref.read(friendsApiProvider).getFriendship(widget.friendshipId);
      if (mounted) setState(() => _friendship = friendship);
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Unable to load friend details.'));
    }
  }

  Future<void> _settleAll() async {
    try {
      final settledCount =
          await ref.read(friendsApiProvider).settleFriend(widget.friendshipId);
      notifyDataChanged(ref);
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              settledCount == 0 ? 'Already settled up.' : 'All bills settled up.',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(apiErrorMessage(e, 'Unable to settle up with this friend.'))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(dataRefreshProvider, (_, __) => _load());

    final friendship = _friendship;

    return Scaffold(
      appBar: AppBar(
        title: Text(friendship != null ? displayName(friendship.friend) : 'Friend'),
        actions: [
          TextButton(onPressed: _settleAll, child: const Text('Settle up')),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.accent,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
            if (friendship != null) ...[
              Text(friendship.friend.email, style: const TextStyle(color: AppColors.text)),
              const SizedBox(height: 24),
              Row(
                children: [
                  const Text('Direct bills', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  const Spacer(),
                  CountBadge(count: friendship.bills.length),
                ],
              ),
              const SizedBox(height: 12),
              BillList(
                bills: friendship.bills,
                onChanged: _load,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
