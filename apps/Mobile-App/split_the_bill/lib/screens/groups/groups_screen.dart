import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../api/api_exception.dart';
import '../../constants/group_icons.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/modals/create_group_sheet.dart';

class GroupsScreen extends ConsumerStatefulWidget {
  const GroupsScreen({super.key});

  @override
  ConsumerState<GroupsScreen> createState() => _GroupsScreenState();
}

class _GroupsScreenState extends ConsumerState<GroupsScreen> {
  List<GroupSummary>? _groups;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final groups = await ref.read(groupsApiProvider).listGroups();
      if (mounted) setState(() => _groups = groups);
    } catch (e) {
      if (mounted) {
        setState(() => _error = apiErrorMessage(e, 'Unable to load groups.'));
      }
    }
  }

  String _balanceLabel(int cents) {
    if (cents == 0) return 'Settled up';
    if (cents > 0) return 'You +${formatCad(cents)}';
    return 'You ${formatCad(cents)}';
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(dataRefreshProvider, (_, __) => _load());

    final groups = _groups;

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.accent,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              const Text(
                'Your groups',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
              ),
              const Spacer(),
              TextButton.icon(
                onPressed: () => showCreateGroupSheet(context),
                icon: const Icon(Icons.add),
                label: const Text('New'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
          if (groups == null)
            const LoadingView(message: 'Loading groups...')
          else if (groups.isEmpty)
            const EmptyState(
              message: 'Create a group to split expenses together.',
            )
          else
            ...groups.map((group) {
              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () => context.push('/groups/${group.id}'),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: AppColors.accentSoft,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(
                            groupIconForKey(group.iconKey),
                            color: AppColors.accent,
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                group.name,
                                style: const TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${group.memberCount} members · ${_balanceLabel(group.netBalanceCents)}',
                                style: const TextStyle(color: AppColors.text),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.chevron_right, color: AppColors.text),
                      ],
                    ),
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}
