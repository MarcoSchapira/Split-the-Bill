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
import '../../widgets/modals/bill_form_sheet.dart';

class FriendsScreen extends ConsumerStatefulWidget {
  const FriendsScreen({super.key});

  @override
  ConsumerState<FriendsScreen> createState() => _FriendsScreenState();
}

class _FriendsScreenState extends ConsumerState<FriendsScreen> {
  List<FriendshipSummary> _friends = [];
  List<GroupSummary> _groups = [];
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
        ref.read(groupsApiProvider).listGroups(),
        ref.read(invitationsApiProvider).getInvitations(),
      ]);
      if (mounted) {
        setState(() {
          _friends = results[0] as List<FriendshipSummary>;
          _dashboard = results[1] as Dashboard;
          _groups = results[2] as List<GroupSummary>;
          _invitations = results[3] as Invitations;
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

  String _recipientLabel(FriendInvitation invite) {
    return invite.recipient?.name ?? invite.recipient?.email ?? invite.recipientEmail ?? 'Unknown';
  }

  Future<void> _answerInvitation(String kind, String invitationId, String decision) async {
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
          const Text('Friends', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),
          if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
          if (_friends.isEmpty)
            const EmptyState(message: 'No friends yet. Send an invitation from the menu.')
          else
            ..._friends.map((friendship) {
              final cents = _balanceFor(friendship.id);
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  title: Text(displayName(friendship.friend)),
                  subtitle: Text(friendship.friend.email),
                  trailing: cents != null ? BalanceChip(cents: cents) : null,
                  onTap: () => context.push('/friends/${friendship.id}'),
                ),
              );
            }),
          const SizedBox(height: 24),
          Row(
            children: [
              const Text('Invitations', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
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
                .map((invite) => Card(
                      color: AppColors.pendingBg,
                      margin: const EdgeInsets.only(bottom: 8),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${displayName(invite.sender)} wants to be friends.',
                              style: const TextStyle(color: AppColors.pendingText),
                            ),
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: () => _answerInvitation('friend', invite.id, 'decline'),
                                    child: const Text('Decline'),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: FilledButton(
                                    onPressed: () => _answerInvitation('friend', invite.id, 'accept'),
                                    style: FilledButton.styleFrom(backgroundColor: AppColors.accent),
                                    child: const Text('Accept'),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    )),
            ...invitations.receivedGroups
                .where((i) => i.status == InvitationStatus.pending)
                .map((invite) => Card(
                      color: AppColors.pendingBg,
                      margin: const EdgeInsets.only(bottom: 8),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${displayName(invite.sender)} invited you to ${invite.groupRef.name}.',
                              style: const TextStyle(color: AppColors.pendingText),
                            ),
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: () => _answerInvitation('group', invite.id, 'decline'),
                                    child: const Text('Decline'),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: FilledButton(
                                    onPressed: () => _answerInvitation('group', invite.id, 'accept'),
                                    style: FilledButton.styleFrom(backgroundColor: AppColors.accent),
                                    child: const Text('Accept'),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    )),
            if (receivedPending == 0)
              const EmptyState(message: 'No invitations waiting for your response.'),
            const SizedBox(height: 8),
            const Text('Sent invitations', style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            ...invitations.sentFriends.map((invite) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text('Friend request to ${_recipientLabel(invite)}'),
                    trailing: Text(invite.status.name),
                  ),
                )),
            ...invitations.sentGroups.map((invite) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(
                      'Group invite to ${invite.groupRef.name} (${_recipientLabel(invite)})',
                    ),
                    trailing: Text(invite.status.name),
                  ),
                )),
          ],
          const SizedBox(height: 24),
          Row(
            children: [
              const Text('Groups', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const Spacer(),
              CountBadge(count: _groups.length),
            ],
          ),
          const SizedBox(height: 12),
          if (_groups.isEmpty)
            const EmptyState(message: 'No groups yet. Create one from the menu.')
          else
            ..._groups.map((group) {
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  title: Text(group.name),
                  subtitle: Text(group.role),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/groups/${group.id}'),
                ),
              );
            }),
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

  Future<void> _addBill() async {
    await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => BillFormSheet(
        fixedTarget: BillTarget(
          targetType: TargetType.friendship,
          targetId: widget.friendshipId,
        ),
        onSaved: _load,
      ),
    );
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
          IconButton(onPressed: _addBill, icon: const Icon(Icons.add)),
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
              if (friendship.sharedGroups.isNotEmpty) ...[
                const SizedBox(height: 24),
                const Eyebrow('Shared groups'),
                const SizedBox(height: 8),
                Text(
                  'Group bills with ${displayName(friendship.friend)}',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 12),
                ...friendship.sharedGroups.map((group) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: InkWell(
                              onTap: () => context.go('/groups/${group.id}'),
                              child: Text(
                                group.name,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.accent,
                                ),
                              ),
                            ),
                          ),
                          CountBadge(count: group.bills.length),
                        ],
                      ),
                      const SizedBox(height: 8),
                      BillList(
                        bills: group.bills,
                        friend: friendship.friend,
                        emptyMessage:
                            'No direct balances from group bills with ${displayName(friendship.friend)}.',
                        onChanged: _load,
                      ),
                      const SizedBox(height: 16),
                    ],
                  );
                }),
              ],
            ],
          ],
        ),
      ),
    );
  }
}
