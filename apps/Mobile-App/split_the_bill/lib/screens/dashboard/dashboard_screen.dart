import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../api/api_exception.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../utils/dashboard_people.dart';
import '../../utils/format.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/friend_invitations.dart';
import '../../widgets/modals/manage_friends_sheet.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  Dashboard? _dashboard;
  List<DashboardPerson> _people = [];
  Invitations? _invitations;
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
      final friends = results[0] as List<FriendshipSummary>;
      final dashboard = results[1] as Dashboard;
      final invitations = results[2] as Invitations;
      final people = buildDashboardPeople(friends: friends, dashboard: dashboard);
      if (mounted) {
        setState(() {
          _dashboard = dashboard;
          _invitations = invitations;
          _people = people;
        });
      }
    } catch (e) {
      if (mounted)
        setState(
          () => _error = apiErrorMessage(e, 'Unable to load dashboard.'),
        );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _answerInvitation(String invitationId, String decision) async {
    setState(() => _error = null);
    try {
      await ref.read(invitationsApiProvider).answerFriendInvitation(invitationId, decision);
      notifyDataChanged(ref);
      await _load();
    } catch (e) {
      if (mounted) {
        setState(() => _error = apiErrorMessage(e, 'Unable to update invitation.'));
      }
    }
  }

  Future<void> _cancelSentInvitation(String invitationId) async {
    setState(() => _error = null);
    try {
      await ref.read(invitationsApiProvider).cancelFriendInvitation(invitationId);
      notifyDataChanged(ref);
      await _load();
    } catch (e) {
      if (mounted) {
        setState(() => _error = apiErrorMessage(e, 'Unable to cancel invitation.'));
      }
      rethrow;
    }
  }

  Future<void> _openManageFriendsSheet() async {
    await showManageFriendsSheet(
      context,
      invitations: _invitations,
      onAnswerInvitation: _answerInvitation,
      onCancelSentInvitation: _cancelSentInvitation,
      onOpenAddFriend: () async {
        await showAddFriendSheet(context);
        if (mounted) await _load();
      },
    );
    if (mounted) await _load();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(dataRefreshProvider, (_, __) => _load());

    if (_isLoading && _dashboard == null) {
      return const LoadingView(message: 'Loading balances...');
    }

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.accent,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const Expanded(
                  child: Text(
                    'Dashboard',
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
                  ),
                ),
                IconButton(
                  tooltip: 'Activity',
                  icon: const Icon(Icons.history),
                  onPressed: () => context.push('/dashboard/activity'),
                ),
              ],
            ),
            const SizedBox(height: 4),
            const Text('Keep track of every shared balance in one place.'),
            const SizedBox(height: 16),
            if (_error != null) ...[
              ErrorBanner(message: _error!),
              const SizedBox(height: 12),
            ],
            if (_dashboard != null) ...[
              Row(
                children: [
                  Expanded(
                    child: SummaryCard(
                      label: 'You are owed',
                      amount: formatCad(_dashboard!.totalOwedToYouCents),
                      positive: true,
                      onTap: () => context.go('/requests?tab=owed-to-you'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: SummaryCard(
                      label: 'You owe',
                      amount: formatCad(_dashboard!.totalYouOweCents),
                      negative: true,
                      onTap: () => context.go('/requests?tab=you-owe'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              SummaryCard(
                label: 'Net balance',
                amount: formatCad(_dashboard!.netBalanceCents),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  const Text(
                    'Friends',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                  const Spacer(),
                  _ManageFriendsButton(onPressed: _openManageFriendsSheet),
                ],
              ),
              const SizedBox(height: 12),
              if (_people.isEmpty)
                const EmptyState(
                  message: 'No friends yet. Tap Manage friends to send an invitation.',
                )
              else
                ..._people.map((person) {
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      title: Text(displayName(person.friendship.friend)),
                      subtitle: Text(person.friendship.friend.email),
                      trailing: BalanceChip(cents: person.balanceCents),
                      onTap: () => context.push('/friends/${person.friendship.id}'),
                    ),
                  );
                }),
            ],
          ],
        ),
      ),
    );
  }
}

class _ManageFriendsButton extends StatelessWidget {
  const _ManageFriendsButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.accentSoft,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(999),
        child: const Padding(
          padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Text(
            'Manage friends',
            style: TextStyle(
              color: AppColors.accent,
              fontWeight: FontWeight.w700,
              fontSize: 13,
            ),
          ),
        ),
      ),
    );
  }
}
