import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../api/api_exception.dart';
import '../../models/models.dart';
import '../../models/user.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../common_widgets.dart';
import 'membership_scope_dialog.dart';

Future<void> showAddGroupMemberSheet(
  BuildContext context, {
  required GroupDetail group,
  required List<User> availableFriends,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => AddGroupMemberSheet(
      group: group,
      availableFriends: availableFriends,
    ),
  );
}

class AddGroupMemberSheet extends ConsumerStatefulWidget {
  const AddGroupMemberSheet({
    super.key,
    required this.group,
    required this.availableFriends,
  });

  final GroupDetail group;
  final List<User> availableFriends;

  @override
  ConsumerState<AddGroupMemberSheet> createState() => _AddGroupMemberSheetState();
}

class _AddGroupMemberSheetState extends ConsumerState<AddGroupMemberSheet> {
  String _query = '';
  String? _error;
  bool _isSaving = false;

  List<User> get _filteredFriends {
    if (_query.isEmpty) return widget.availableFriends;
    final lower = _query.toLowerCase();
    return widget.availableFriends.where((friend) {
      return displayName(friend).toLowerCase().contains(lower) ||
          friend.email.toLowerCase().contains(lower);
    }).toList();
  }

  Future<void> _addFriend(User friend) async {
    setState(() {
      _error = null;
      _isSaving = true;
    });

    try {
      var scope = MembershipRetroactiveScope.newOnly;
      if (widget.group.hasExistingBills) {
        if (!mounted) return;
        final selected = await showMembershipScopeDialog(
          context,
          action: MembershipScopeAction.add,
          subjectName: displayName(friend),
          groupName: widget.group.name,
        );
        if (selected == null) {
          return;
        }
        scope = selected;
      }

      await ref.read(groupsApiProvider).addMember(
        widget.group.id,
        friend.id,
        retroactiveScope: membershipScopeToApi(scope),
      );
      notifyDataChanged(ref);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${displayName(friend)} added to the group.')),
        );
      }
    } catch (e) {
      setState(() => _error = apiErrorMessage(e, 'Unable to add member.'));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final friends = _filteredFriends;

    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Add member', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          const Text('Choose a friend to add to this group.'),
          const SizedBox(height: 16),
          if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
          TextField(
            decoration: const InputDecoration(
              hintText: 'Search friends',
              prefixIcon: Icon(Icons.search),
            ),
            onChanged: (value) => setState(() => _query = value.trim()),
          ),
          const SizedBox(height: 12),
          if (_isSaving) const LinearProgressIndicator(minHeight: 2),
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.sizeOf(context).height * 0.45,
            ),
            child: friends.isEmpty
                ? const EmptyState(message: 'No friends available to add.')
                : ListView.separated(
                    shrinkWrap: true,
                    itemCount: friends.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final friend = friends[index];
                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(displayName(friend)),
                        subtitle: Text(friend.email),
                        trailing: const Icon(Icons.add_circle_outline),
                        onTap: _isSaving ? null : () => _addFriend(friend),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
