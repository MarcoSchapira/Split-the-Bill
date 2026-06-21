import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../models/receipt.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../../utils/capture_bill_split.dart';
import '../../utils/format.dart';
import '../../widgets/bill_flow/bill_flow_step_header.dart';
import '../../widgets/bill_flow/bill_flow_summary_card.dart';
import '../../widgets/common_widgets.dart';

class CaptureSplitScreen extends StatefulWidget {
  const CaptureSplitScreen({super.key, required this.flow});

  final BillFlowState flow;

  @override
  State<CaptureSplitScreen> createState() => _CaptureSplitScreenState();
}

class _CaptureSplitScreenState extends State<CaptureSplitScreen> {
  late BillFlowState _flow;
  late Map<int, Set<String>> _assignments;
  bool _unassignedExpanded = false;

  static const _expandedListMaxHeight = 220.0;

  @override
  void initState() {
    super.initState();
    _flow = widget.flow;
    _assignments = Map<int, Set<String>>.from(_flow.assignments);
  }

  ParsedReceipt get _receipt => _flow.receipt!;
  List<User> get _participants => _flow.participants;

  List<int> _selectableIndexesFor(User participant) {
    final indexes = <int>[];
    for (var i = 0; i < _receipt.items.length; i++) {
      final assignees = _assignments[i] ?? {};
      if (assignees.isEmpty || assignees.contains(participant.id)) {
        indexes.add(i);
      }
    }
    return indexes;
  }

  Future<void> _addItemsForUser(User participant) async {
    final selectable = _selectableIndexesFor(participant);

    if (selectable.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No items available to assign.')),
      );
      return;
    }

    final selected = await showModalBottomSheet<Set<int>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        final selectedIndexes = selectable
            .where((index) => _assignments[index]?.contains(participant.id) ?? false)
            .toSet();
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Items for ${displayName(participant)}',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: 12),
                  ...selectable.map(
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
                    label: 'Save',
                    onPressed: () => Navigator.pop(context, Set<int>.from(selectedIndexes)),
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
      for (final index in selectable) {
        final current = Set<String>.from(_assignments[index] ?? {});
        if (selected.contains(index)) {
          current.add(participant.id);
        } else {
          current.remove(participant.id);
        }
        _assignments[index] = current;
      }
    });
  }

  bool get _allAssigned {
    for (var i = 0; i < _receipt.items.length; i++) {
      if ((_assignments[i] ?? {}).isEmpty) return false;
    }
    return _receipt.items.isNotEmpty;
  }

  List<int> get _unassignedIndexes {
    final indexes = <int>[];
    for (var i = 0; i < _receipt.items.length; i++) {
      if ((_assignments[i] ?? {}).isEmpty) {
        indexes.add(i);
      }
    }
    return indexes;
  }

  void _toggleUnassignedPanel() {
    setState(() => _unassignedExpanded = !_unassignedExpanded);
  }

  Widget _buildBottomBar() {
    final unassigned = _unassignedIndexes;
    final count = unassigned.length;
    final countLabel = count == 1 ? '1 item left' : '$count items left';

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Material(
          elevation: 6,
          shadowColor: AppColors.textH.withValues(alpha: 0.12),
          color: AppColors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: AppColors.border),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              InkWell(
                onTap: _toggleUnassignedPanel,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          count == 0 ? 'All items assigned' : countLabel,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            color: AppColors.textH,
                          ),
                        ),
                      ),
                      AnimatedRotation(
                        turns: _unassignedExpanded ? 0.5 : 0,
                        duration: const Duration(milliseconds: 200),
                        child: const Icon(
                          Icons.keyboard_arrow_up,
                          color: AppColors.text,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              AnimatedSize(
                duration: const Duration(milliseconds: 250),
                curve: Curves.easeInOut,
                alignment: Alignment.topCenter,
                clipBehavior: Clip.hardEdge,
                child: _unassignedExpanded
                    ? Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Divider(height: 1, color: AppColors.border),
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxHeight: _expandedListMaxHeight),
                            child: unassigned.isEmpty
                                ? const Padding(
                                    padding: EdgeInsets.all(16),
                                    child: Text(
                                      'Every item has been assigned.',
                                      style: TextStyle(color: AppColors.text),
                                    ),
                                  )
                                : ListView.separated(
                                    shrinkWrap: true,
                                    padding: const EdgeInsets.symmetric(vertical: 8),
                                    itemCount: unassigned.length,
                                    separatorBuilder: (_, __) => const Divider(
                                      height: 1,
                                      indent: 16,
                                      endIndent: 16,
                                      color: AppColors.border,
                                    ),
                                    itemBuilder: (context, listIndex) {
                                      final item = _receipt.items[unassigned[listIndex]];
                                      return ListTile(
                                        dense: true,
                                        title: Text(
                                          item.name,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w600,
                                            color: AppColors.textH,
                                          ),
                                        ),
                                        trailing: Text(
                                          formatCad(item.totalPriceCents),
                                          style: const TextStyle(fontWeight: FontWeight.w600),
                                        ),
                                      );
                                    },
                                  ),
                          ),
                        ],
                      )
                    : const SizedBox(width: double.infinity),
              ),
              const Divider(height: 1, color: AppColors.border),
              Padding(
                padding: const EdgeInsets.all(12),
                child: PrimaryButton(
                  label: _flow.isEditing ? 'Review changes' : 'Review totals',
                  onPressed: _allAssigned ? _continue : null,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _continue() {
    final nextFlow = _flow.copyWith(assignments: _assignments);
    final confirmPath = nextFlow.isEditing
        ? '/bills/${nextFlow.billId}/edit/confirm'
        : '/dashboard/capture/confirm';
    context.push(confirmPath, extra: nextFlow);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_receipt.storeName ?? 'Split bill'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const BillFlowStepHeader(stepNumber: 2, totalSteps: 3, title: 'Assign items'),
                const SizedBox(height: 12),
                BillFlowSummaryCard(
                  receipt: _receipt,
                  payerName: displayName(
                    _participants.firstWhere(
                      (participant) => participant.id == _flow.payerId,
                      orElse: () => _flow.currentUser,
                    ),
                  ),
                  incurredAt: _flow.incurredAt,
                  eyebrowText: _flow.isEditing ? 'Editing receipt' : 'Captured receipt',
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
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
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => _addItemsForUser(participant),
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
                              const SizedBox(width: 4),
                              const Icon(Icons.add_circle_outline, color: AppColors.accent),
                            ],
                          ),
                          if (entries.isEmpty)
                            const Padding(
                              padding: EdgeInsets.only(top: 4),
                              child: Text(
                                'No items assigned yet',
                                style: TextStyle(color: AppColors.text),
                              ),
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
                  ),
                );
              },
            ),
          ),
        ],
      ),
      bottomNavigationBar: _buildBottomBar(),
    );
  }
}
