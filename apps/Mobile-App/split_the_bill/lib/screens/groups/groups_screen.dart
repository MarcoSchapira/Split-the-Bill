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

class GroupsScreen extends ConsumerStatefulWidget {
  const GroupsScreen({super.key});

  @override
  ConsumerState<GroupsScreen> createState() => _GroupsScreenState();
}

class _GroupsScreenState extends ConsumerState<GroupsScreen> {
  List<GroupSummary> _groups = [];
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
      final groups = await ref.read(groupsApiProvider).listGroups();
      if (mounted) setState(() => _groups = groups);
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Unable to load groups.'));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(dataRefreshProvider, (_, __) => _load());

    if (_isLoading && _groups.isEmpty) {
      return const LoadingView(message: 'Loading groups...');
    }

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.accent,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Groups', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),
          if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
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

class GroupDetailScreen extends ConsumerStatefulWidget {
  const GroupDetailScreen({super.key, required this.groupId});

  final String groupId;

  @override
  ConsumerState<GroupDetailScreen> createState() => _GroupDetailScreenState();
}

class _GroupDetailScreenState extends ConsumerState<GroupDetailScreen> {
  GroupDetail? _group;
  List<Bill> _bills = [];
  String? _error;
  String? _inviteError;
  String? _inviteNotice;
  bool _isLoading = true;
  bool _isInviting = false;
  final _emailController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _error = null;
      _isLoading = true;
    });

    try {
      final group = await ref.read(groupsApiProvider).getGroup(widget.groupId);
      final bills = await ref.read(billsApiProvider).listBills(
            targetType: TargetType.group,
            targetId: widget.groupId,
          );
      if (mounted) {
        setState(() {
          _group = group;
          _bills = bills;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Unable to load this group.'));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _invite() async {
    setState(() {
      _inviteError = null;
      _inviteNotice = null;
      _isInviting = true;
    });

    try {
      await ref.read(groupsApiProvider).inviteGroupMember(
            widget.groupId,
            _emailController.text.trim(),
          );
      _emailController.clear();
      notifyDataChanged(ref);
      setState(() => _inviteNotice = 'Invitation sent. They will appear after accepting.');
    } catch (e) {
      setState(() => _inviteError = apiErrorMessage(e, 'Unable to send invitation.'));
    } finally {
      if (mounted) setState(() => _isInviting = false);
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
        fixedTarget: BillTarget(targetType: TargetType.group, targetId: widget.groupId),
        onSaved: _load,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(dataRefreshProvider, (_, __) => _load());

    final group = _group;

    return Scaffold(
      appBar: AppBar(
        title: Text(group?.name ?? 'Group'),
        actions: [
          IconButton(onPressed: _addBill, icon: const Icon(Icons.add)),
        ],
      ),
      body: _isLoading && group == null
          ? const LoadingView(message: 'Loading group...')
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.accent,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
                  if (group != null) ...[
                    Eyebrow('${group.role} access'),
                    const SizedBox(height: 4),
                    Text(
                      '${group.members.length} accepted member${group.members.length == 1 ? '' : 's'}',
                      style: const TextStyle(color: AppColors.text),
                    ),
                    const SizedBox(height: 24),
                    Row(
                      children: [
                        const Text('Bills', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                        const Spacer(),
                        CountBadge(count: _bills.length),
                      ],
                    ),
                    const SizedBox(height: 12),
                    BillList(bills: _bills, onChanged: _load),
                    const SizedBox(height: 24),
                    const Text('Members', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 12),
                    ...group.members.map((member) {
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          title: Text(displayName(member.user)),
                          subtitle: Text('${member.user.email} · ${member.role}'),
                        ),
                      );
                    }),
                    const SizedBox(height: 24),
                    const Text('Invite member', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 12),
                    if (_inviteError != null) ...[
                      ErrorBanner(message: _inviteError!),
                      const SizedBox(height: 12),
                    ],
                    if (_inviteNotice != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(_inviteNotice!, style: const TextStyle(color: AppColors.accent)),
                      ),
                    TextField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(labelText: 'Email'),
                    ),
                    const SizedBox(height: 12),
                    PrimaryButton(
                      label: 'Send invitation',
                      onPressed: _invite,
                      isLoading: _isInviting,
                      compact: true,
                    ),
                  ],
                ],
              ),
            ),
    );
  }
}
