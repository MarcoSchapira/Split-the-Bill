import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../api/api_exception.dart';
import '../../constants/group_icons.dart';
import '../../models/models.dart';
import '../../models/user.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../../widgets/bill_list/bill_list.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/modals/add_group_member_sheet.dart';
import '../../widgets/modals/create_group_sheet.dart';
import '../../widgets/modals/membership_scope_dialog.dart';

class GroupDetailScreen extends ConsumerStatefulWidget {
  const GroupDetailScreen({super.key, required this.groupId});

  final String groupId;

  @override
  ConsumerState<GroupDetailScreen> createState() => _GroupDetailScreenState();
}

class _GroupDetailScreenState extends ConsumerState<GroupDetailScreen> {
  GroupDetail? _group;
  List<User> _friends = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        ref.read(groupsApiProvider).getGroup(widget.groupId),
        ref.read(friendsApiProvider).listFriends(),
      ]);
      if (!mounted) return;
      setState(() {
        _group = results[0] as GroupDetail;
        _friends = (results[1] as List<FriendshipSummary>)
            .map((friendship) => friendship.friend)
            .toList();
        _error = null;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _error = apiErrorMessage(e, 'Unable to load group.'));
      }
    }
  }

  Future<void> _openAddMember() async {
    final group = _group;
    if (group == null) return;

    final memberIds = group.members.map((member) => member.user.id).toSet();
    final available = _friends
        .where((friend) => !memberIds.contains(friend.id))
        .toList();

    if (available.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add friends before inviting them to a group.')),
      );
      return;
    }

    await showAddGroupMemberSheet(
      context,
      group: group,
      availableFriends: available,
    );
    await _load();
  }

  Future<void> _removeMember(GroupMemberDetail member) async {
    final group = _group;
    if (group == null) return;

    var scope = MembershipRetroactiveScope.newOnly;
    if (group.unsettledBillCount > 0) {
      final selected = await showMembershipScopeDialog(
        context,
        action: MembershipScopeAction.remove,
        subjectName: displayName(member.user),
        groupName: group.name,
      );
      if (selected == null) return;
      scope = selected;
    }

    try {
      await ref.read(groupsApiProvider).removeMember(
        group.id,
        member.user.id,
        retroactiveScope: membershipScopeToApi(scope),
      );
      notifyDataChanged(ref);
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${displayName(member.user)} removed.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(apiErrorMessage(e, 'Unable to remove member.'))),
        );
      }
    }
  }

  Future<void> _leaveGroup() async {
    final group = _group;
    if (group == null) return;

    var scope = MembershipRetroactiveScope.newOnly;
    if (group.unsettledBillCount > 0) {
      final selected = await showMembershipScopeDialog(
        context,
        action: MembershipScopeAction.leave,
        subjectName: 'You',
        groupName: group.name,
      );
      if (selected == null) return;
      scope = selected;
    }

    try {
      final result = await ref.read(groupsApiProvider).leaveGroup(
        group.id,
        retroactiveScope: membershipScopeToApi(scope),
      );
      notifyDataChanged(ref);
      if (!mounted) return;
      if (result == null) {
        context.go('/groups');
      } else {
        await _load();
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You left the group.')),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(apiErrorMessage(e, 'Unable to leave group.'))),
        );
      }
    }
  }

  void _addExpense() {
    context.push(
      '/dashboard/capture/manual',
      extra: {'groupId': widget.groupId},
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(dataRefreshProvider, (_, __) => _load());

    final group = _group;
    final currentUserId = ref.watch(authProvider).user?.id;
    final isCreator = group != null && group.creatorId == currentUserId;

    return Scaffold(
      appBar: AppBar(
        title: Text(group?.name ?? 'Group'),
        actions: [
          if (group != null)
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              onPressed: () => showCreateGroupSheet(
                context,
                groupId: group.id,
                initialName: group.name,
                initialIconKey: group.iconKey,
              ).then((_) => _load()),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.accent,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
            if (group != null) ...[
              Row(
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: AppColors.accentSoft,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(
                      groupIconForKey(group.iconKey),
                      color: AppColors.accent,
                      size: 28,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${group.members.length} members',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Created ${formatDateUtc(group.createdAt)}',
                          style: const TextStyle(color: AppColors.text),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: PrimaryButton(
                      label: 'Add expense',
                      onPressed: _addExpense,
                      compact: true,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: SecondaryButton(
                      label: 'Add member',
                      onPressed: _openAddMember,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              const Text('Members', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              ...group.members.map((member) {
                final isSelf = member.user.id == currentUserId;
                final canRemove = isCreator && !isSelf;
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(displayName(member.user)),
                    subtitle: Text(
                      member.isCreator
                          ? 'Creator'
                          : isSelf
                          ? 'You'
                          : member.user.email,
                    ),
                    trailing: canRemove
                        ? IconButton(
                            icon: const Icon(Icons.close, color: AppColors.error),
                            onPressed: () => _removeMember(member),
                          )
                        : null,
                  ),
                );
              }),
              const SizedBox(height: 24),
              Row(
                children: [
                  const Text(
                    'Group bills',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                  const Spacer(),
                  CountBadge(count: group.billCount),
                ],
              ),
              const SizedBox(height: 12),
              BillList(bills: group.bills),
              const SizedBox(height: 24),
              SecondaryButton(label: 'Leave group', onPressed: _leaveGroup),
            ] else if (_error == null)
              const LoadingView(message: 'Loading group...'),
          ],
        ),
      ),
    );
  }
}
