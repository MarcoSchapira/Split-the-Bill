import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../models/receipt.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../../utils/capture_bill_split.dart';
import '../../utils/format.dart';
import '../../widgets/capture/capture_assign_sheet.dart';
import '../../widgets/common_widgets.dart';

class CaptureSplitScreen extends StatefulWidget {
  const CaptureSplitScreen({super.key, required this.flow});

  final CaptureFlowState flow;

  @override
  State<CaptureSplitScreen> createState() => _CaptureSplitScreenState();
}

class _CaptureSplitScreenState extends State<CaptureSplitScreen>
    with SingleTickerProviderStateMixin {
  late CaptureFlowState _flow;
  late Map<int, Set<String>> _assignments;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _flow = widget.flow;
    _assignments = Map<int, Set<String>>.from(_flow.assignments);
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  ParsedReceipt get _receipt => _flow.receipt!;
  List<User> get _participants => _flow.participants;

  Future<void> _assignItem(int index) async {
    final selected = await showModalBottomSheet<Set<String>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => CaptureAssignSheet(
        title: 'Assign "${_receipt.items[index].name}"',
        participants: _participants,
        initialSelected: _assignments[index] ?? {},
      ),
    );

    if (selected != null) {
      setState(() => _assignments[index] = selected);
    }
  }

  Future<void> _addItemsForUser(User participant) async {
    final unassigned = <int>[];
    for (var i = 0; i < _receipt.items.length; i++) {
      if (!(_assignments[i]?.contains(participant.id) ?? false)) {
        unassigned.add(i);
      }
    }

    if (unassigned.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('All items are already assigned to this person.')),
      );
      return;
    }

    final selected = await showModalBottomSheet<Set<String>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        final selectedIndexes = <int>{};
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Add items for ${displayName(participant)}',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: 12),
                  ...unassigned.map(
                    (index) {
                      final item = _receipt.items[index];
                      return CheckboxListTile(
                        value: selectedIndexes.contains(index),
                        activeColor: AppColors.accent,
                        title: Text(item.name),
                        subtitle: Text(formatCad(item.totalPriceCents)),
                        onChanged: (value) {
                          setModalState(() {
                            if (value == true) {
                              selectedIndexes.add(index);
                            } else {
                              selectedIndexes.remove(index);
                            }
                          });
                        },
                      );
                    },
                  ),
                  const SizedBox(height: 12),
                  PrimaryButton(
                    label: 'Add selected',
                    onPressed: selectedIndexes.isEmpty
                        ? null
                        : () => Navigator.pop(
                              context,
                              selectedIndexes.map((i) => i.toString()).toSet(),
                            ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );

    if (selected == null) return;

    setState(() {
      for (final key in selected) {
        final index = int.parse(key);
        final current = _assignments[index] ?? {};
        _assignments[index] = {...current, participant.id};
      }
    });
  }

  bool get _allAssigned {
    for (var i = 0; i < _receipt.items.length; i++) {
      if ((_assignments[i] ?? {}).isEmpty) return false;
    }
    return _receipt.items.isNotEmpty;
  }

  void _continue() {
    final nextFlow = _flow.copyWith(assignments: _assignments);
    context.push('/dashboard/capture/confirm', extra: nextFlow);
  }

  Widget _receiptTab() {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _receipt.items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final item = _receipt.items[index];
        final assigned = _assignments[index] ?? {};
        final isUnassigned = assigned.isEmpty;

        return Card(
          color: isUnassigned ? AppColors.surface : null,
          child: ListTile(
            title: Text(
              item.name,
              style: TextStyle(
                color: isUnassigned ? AppColors.text : AppColors.textH,
                fontWeight: FontWeight.w600,
              ),
            ),
            subtitle: Text('Qty ${item.quantity} · ${formatCad(item.totalPriceCents)}'),
            trailing: IconButton(
              icon: const Icon(Icons.add_circle_outline),
              color: AppColors.accent,
              onPressed: () => _assignItem(index),
            ),
          ),
        );
      },
    );
  }

  Widget _friendsTab() {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _participants.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final participant = _participants[index];
        final entries = itemsForUser(
          items: _receipt.items,
          assignments: _assignments,
          targetUserId: participant.id,
        );
        final subtotal = entries.fold<int>(0, (sum, entry) => sum + entry.shareCents);

        return Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        displayName(participant),
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                    Text(
                      formatCad(subtotal),
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    IconButton(
                      icon: const Icon(Icons.add_circle_outline),
                      color: AppColors.accent,
                      onPressed: () => _addItemsForUser(participant),
                    ),
                  ],
                ),
                if (entries.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 4),
                    child: Text('No items assigned yet', style: TextStyle(color: AppColors.text)),
                  )
                else
                  ...entries.map(
                    (entry) => Padding(
                      padding: const EdgeInsets.only(top: 6, left: 4),
                      child: Row(
                        children: [
                          Expanded(child: Text(entry.item.name)),
                          Text(formatCad(entry.shareCents)),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_receipt.storeName ?? 'Split bill'),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.accent,
          tabs: const [
            Tab(text: 'Receipt'),
            Tab(text: 'Friends'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _receiptTab(),
          _friendsTab(),
        ],
      ),
      bottomNavigationBar: Padding(
        padding: const EdgeInsets.all(16),
        child: PrimaryButton(
          label: 'Review totals',
          onPressed: _allAssigned ? _continue : null,
        ),
      ),
    );
  }
}
