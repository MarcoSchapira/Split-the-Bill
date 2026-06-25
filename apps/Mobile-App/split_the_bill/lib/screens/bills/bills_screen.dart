import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../api/api_exception.dart';
import '../../models/models.dart';
import '../../models/user.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../../widgets/bill_list/bill_list.dart';
import '../../widgets/common_widgets.dart';

class BillsScreen extends ConsumerStatefulWidget {
  const BillsScreen({super.key});

  @override
  ConsumerState<BillsScreen> createState() => _BillsScreenState();
}

class _BillsScreenState extends ConsumerState<BillsScreen> {
  List<Bill> _bills = [];
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
      final bills = await ref.read(billsApiProvider).listBills();
      if (mounted) setState(() => _bills = bills);
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Unable to load bills.'));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(dataRefreshProvider, (_, __) => _load());

    if (_isLoading && _bills.isEmpty) {
      return const LoadingView(message: 'Loading bills...');
    }

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.accent,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Bills', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          const Text('All recorded bills and captured receipts.'),
          const SizedBox(height: 16),
          if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
          BillList(bills: _bills, onChanged: _load),
        ],
      ),
    );
  }
}

class BillDetailScreen extends ConsumerStatefulWidget {
  const BillDetailScreen({super.key, required this.billId});

  final String billId;

  @override
  ConsumerState<BillDetailScreen> createState() => _BillDetailScreenState();
}

class _BillDetailScreenState extends ConsumerState<BillDetailScreen> {
  Bill? _bill;
  String? _error;
  Set<String> _expandedParticipantIds = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final bill = await ref.read(billsApiProvider).getBill(widget.billId);
      if (mounted) {
        setState(() {
          _bill = bill;
          _expandedParticipantIds = {};
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Unable to load bill details.'));
    }
  }

  String _formatQuantity(double quantity) {
    if (quantity == quantity.roundToDouble()) {
      return quantity.toInt().toString();
    }
    return quantity.toStringAsFixed(3).replaceFirst(RegExp(r'0+$'), '').replaceFirst(RegExp(r'\.$'), '');
  }

  List<_ParticipantGroup> _buildParticipantGroups(Bill bill) {
    final groupedByUser = <String, _ParticipantGroup>{};
    for (final share in bill.shares) {
      groupedByUser[share.user.id] = _ParticipantGroup(
        userId: share.user.id,
        user: share.user,
        shareCents: share.shareCents,
        isPayer: share.user.id == bill.payerId,
        items: const [],
      );
    }

    for (final item in bill.lineItems) {
      for (final assignment in item.assignments) {
        final existing = groupedByUser[assignment.user.id];
        if (existing == null) {
          continue;
        }
        groupedByUser[assignment.user.id] = existing.copyWith(
          items: [...existing.items, item],
        );
      }
    }

    final groups = groupedByUser.values.toList();
    groups.sort((left, right) {
      if (left.isPayer && !right.isPayer) return -1;
      if (!left.isPayer && right.isPayer) return 1;
      return right.shareCents.compareTo(left.shareCents);
    });
    return groups;
  }

  void _toggleParticipant(String userId) {
    setState(() {
      if (_expandedParticipantIds.contains(userId)) {
        _expandedParticipantIds = {..._expandedParticipantIds}..remove(userId);
      } else {
        _expandedParticipantIds = {..._expandedParticipantIds, userId};
      }
    });
  }

  Future<void> _editBill(Bill bill) async {
    await context.push('/bills/${bill.id}/edit');
  }

  Future<void> _settleBill(Bill bill) async {
    try {
      await ref.read(billsApiProvider).settleBill(bill.id);
      notifyDataChanged(ref);
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Bill settled up.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(apiErrorMessage(e, 'Unable to settle this bill.'))),
        );
      }
    }
  }

  Future<void> _unsettleBill(Bill bill) async {
    try {
      await ref.read(billsApiProvider).unsettleBill(bill.id);
      notifyDataChanged(ref);
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Settlement undone.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(apiErrorMessage(e, 'Unable to undo settlement.'))),
        );
      }
    }
  }

  Future<void> _deleteBill(Bill bill) async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Delete bill',
      message: 'Delete "${bill.description}"? This cannot be undone.',
    );
    if (confirmed != true) return;

    try {
      await ref.read(billsApiProvider).deleteBill(bill.id);
      notifyDataChanged(ref);
      if (mounted) context.pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(apiErrorMessage(e, 'Unable to delete bill.'))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(dataRefreshProvider, (_, __) => _load());
    final bill = _bill;
    final summary = bill?.userSummary;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bill'),
        actions: [
          if (bill?.canEdit == true)
            IconButton(
              onPressed: () => _editBill(bill!),
              icon: const Icon(Icons.edit_outlined),
              tooltip: 'Edit bill',
            ),
          if (bill?.canDelete == true)
            IconButton(
              onPressed: () => _deleteBill(bill!),
              icon: const Icon(Icons.delete_outline),
              tooltip: 'Delete bill',
              color: AppColors.error,
            ),
        ],
      ),
      body: bill == null
          ? (_error != null
              ? Center(child: Text(_error!))
              : const LoadingView(message: 'Loading bill...'))
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.accent,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text(
                    bill.description,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textH,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Card(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                      side: const BorderSide(color: AppColors.border),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Eyebrow(bill.source == BillSource.capture ? 'Captured receipt' : 'Manual bill'),
                          const SizedBox(height: 8),
                          Text(
                            formatCad(bill.totalCents),
                            style: const TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textH,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '${formatDateUtc(bill.incurredAt)} · Paid by ${displayName(bill.payer)}',
                            style: const TextStyle(color: AppColors.text),
                          ),
                          if (summary != null && summary.direction != 'none' && summary.amountCents > 0) ...[
                            const SizedBox(height: 12),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              decoration: BoxDecoration(
                                color: summary.settled
                                    ? AppColors.surfaceMuted
                                    : summary.direction == 'owed_to_you'
                                        ? AppColors.accentSoft
                                        : AppColors.errorBg,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: summary.settled
                                  ? Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                            'Settled up',
                                            style: TextStyle(
                                              fontWeight: FontWeight.w600,
                                              color: AppColors.text,
                                            ),
                                          ),
                                        ),
                                        Material(
                                          color: AppColors.surface,
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(999),
                                            side: const BorderSide(color: AppColors.border),
                                          ),
                                          clipBehavior: Clip.antiAlias,
                                          child: InkWell(
                                            onTap: () => _unsettleBill(bill),
                                            borderRadius: BorderRadius.circular(999),
                                            child: const Padding(
                                              padding: EdgeInsets.symmetric(
                                                horizontal: 14,
                                                vertical: 6,
                                              ),
                                              child: Text(
                                                'Undo',
                                                style: TextStyle(
                                                  fontWeight: FontWeight.w600,
                                                  fontSize: 13,
                                                  color: AppColors.textH,
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                      ],
                                    )
                                  : Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                            summary.direction == 'owed_to_you'
                                                ? 'Owes you ${formatCad(summary.amountCents)}'
                                                : 'You owe ${formatCad(summary.amountCents)}',
                                            style: TextStyle(
                                              fontWeight: FontWeight.w600,
                                              color: summary.direction == 'owed_to_you'
                                                  ? AppColors.accent
                                                  : AppColors.error,
                                            ),
                                          ),
                                        ),
                                        Material(
                                          color: AppColors.surface,
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(999),
                                            side: const BorderSide(color: AppColors.border),
                                          ),
                                          clipBehavior: Clip.antiAlias,
                                          child: InkWell(
                                            onTap: () => _settleBill(bill),
                                            borderRadius: BorderRadius.circular(999),
                                            child: Padding(
                                              padding: const EdgeInsets.symmetric(
                                                horizontal: 14,
                                                vertical: 6,
                                              ),
                                              child: Text(
                                                'Settle up',
                                                style: TextStyle(
                                                  fontWeight: FontWeight.w600,
                                                  fontSize: 13,
                                                  color: summary.direction == 'owed_to_you'
                                                      ? AppColors.accent
                                                      : AppColors.error,
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      const Text('Split by person', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                      const Spacer(),
                      CountBadge(count: bill.shares.length),
                    ],
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Tap a person\'s name to see items.',
                    style: TextStyle(color: AppColors.text, fontSize: 13),
                  ),
                  const SizedBox(height: 8),
                  ..._buildParticipantGroups(bill).map((group) {
                    final expanded = _expandedParticipantIds.contains(group.userId);
                    final itemsSubtotalCents =
                        group.items.fold<int>(0, (sum, item) => sum + item.totalPriceCents);
                    final deltaCents = group.shareCents - itemsSubtotalCents;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                        side: const BorderSide(color: AppColors.border),
                      ),
                      child: ExpansionTile(
                        key: ValueKey('participant-${group.userId}-$expanded'),
                        initiallyExpanded: expanded,
                        onExpansionChanged: (_) => _toggleParticipant(group.userId),
                        title: Row(
                          children: [
                            Expanded(
                              child: Text(
                                displayName(group.user),
                                style: const TextStyle(fontWeight: FontWeight.w700),
                              ),
                            ),
                            if (group.isPayer)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.accentSoft,
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: const Text(
                                  'Paid',
                                  style: TextStyle(
                                    color: AppColors.accent,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        subtitle: Text(
                          group.items.isEmpty
                              ? 'No itemized assignments'
                              : '${group.items.length} assigned item${group.items.length == 1 ? '' : 's'}',
                        ),
                        trailing: Text(
                          formatCad(group.shareCents),
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        children: [
                          if (group.items.isEmpty)
                            const Padding(
                              padding: EdgeInsets.fromLTRB(16, 0, 16, 12),
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: Text('No assigned items.'),
                              ),
                            )
                          else
                            ...group.items.map(
                              (item) => ListTile(
                                dense: true,
                                title: Text(item.name),
                                subtitle: Text(
                                  '${_formatQuantity(item.quantity)} × ${formatCad(item.unitPriceCents)}${item.assignments.length > 1 ? ' · shared' : ''}',
                                ),
                                trailing: Text(formatCad(item.totalPriceCents)),
                              ),
                            ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                            child: Text(
                              'Items subtotal ${formatCad(itemsSubtotalCents)}${deltaCents == 0 ? '' : ' · final share differs by ${formatCad(deltaCents.abs())} due to tax/fees/tip allocation'}',
                              style: const TextStyle(color: AppColors.text),
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                  const SizedBox(height: 8),
                  const Text('Totals', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  Text(
                    'Subtotal ${formatCad(bill.subtotalCents ?? 0)}${(bill.otherFeesCents ?? 0) > 0 ? ' • Fees ${formatCad(bill.otherFeesCents!)}' : ''} • Tax ${formatCad(bill.taxCents ?? 0)} • Tip ${formatCad(bill.tipCents ?? 0)}',
                    style: const TextStyle(color: AppColors.text),
                  ),
                  const SizedBox(height: 16),
                  if (bill.storeName != null || bill.paymentMethod != null) ...[
                    const Text('Receipt details', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    if (bill.storeName != null) Text('Store: ${bill.storeName}'),
                    if (bill.storeAddress != null) Text('Address: ${bill.storeAddress}'),
                    if (bill.receiptNumber != null) Text('Receipt #: ${bill.receiptNumber}'),
                    if (bill.receiptDate != null) Text('Date: ${bill.receiptDate}'),
                    if (bill.receiptTime != null) Text('Time: ${bill.receiptTime}'),
                    if (bill.paymentMethod != null)
                      Text('Payment: ${bill.paymentMethod}${bill.cardLast4 != null ? ' •••• ${bill.cardLast4}' : ''}'),
                  ],
                ],
              ),
            ),
    );
  }
}

class _ParticipantGroup {
  const _ParticipantGroup({
    required this.userId,
    required this.user,
    required this.shareCents,
    required this.isPayer,
    required this.items,
  });

  final String userId;
  final User user;
  final int shareCents;
  final bool isPayer;
  final List<BillLineItem> items;

  _ParticipantGroup copyWith({
    List<BillLineItem>? items,
  }) {
    return _ParticipantGroup(
      userId: userId,
      user: user,
      shareCents: shareCents,
      isPayer: isPayer,
      items: items ?? this.items,
    );
  }
}
