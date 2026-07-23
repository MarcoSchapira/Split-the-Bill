import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../api/api_exception.dart';
import '../../models/models.dart';
import '../../models/user.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../../utils/line_item_split.dart';
import '../../utils/request_items.dart';
import '../../widgets/bill_list/bill_list.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/requests/request_settlement_status_panel.dart';

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
      if (mounted) {
        setState(() => _error = apiErrorMessage(e, 'Unable to load bills.'));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(dataRefreshProvider, (previous, next) => _load());

    if (_isLoading && _bills.isEmpty) {
      return const LoadingView(message: 'Loading bills...');
    }

    final isEmpty = _bills.isEmpty && _error == null;

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.accent,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          const Text(
            'Bills',
            style: kTabPageTitleStyle,
          ),
          const SizedBox(height: 4),
          Text(
            'All recorded bills and captured receipts.',
            style: TextStyle(
              color: AppColors.text.withValues(alpha: 0.9),
            ),
          ),
          const SizedBox(height: 16),
          if (_error != null) ...[
            ErrorBanner(message: _error!),
            const SizedBox(height: 12),
          ],
          if (isEmpty)
            const _BillsEmptyState()
          else
            BillList(bills: _bills),
        ],
      ),
    );
  }
}

class _BillsEmptyState extends StatelessWidget {
  const _BillsEmptyState();

  @override
  Widget build(BuildContext context) {
    final viewportHeight = MediaQuery.sizeOf(context).height;
    final contentHeight = (viewportHeight * 0.58).clamp(360.0, 520.0);

    return SizedBox(
      height: contentHeight,
      child: Column(
        children: [
          Expanded(
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 88,
                    height: 88,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          AppColors.accentSoft,
                          AppColors.brandSoft.withValues(alpha: 0.55),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(28),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.accent.withValues(alpha: 0.14),
                          blurRadius: 24,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.receipt_long_rounded,
                      size: 42,
                      color: AppColors.accent,
                    ),
                  ),
                  const SizedBox(height: 28),
                  const Text(
                    'No bills yet',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.6,
                      height: 1.1,
                      color: AppColors.textH,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Your receipts and shared expenses\nwill live here once you add one.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.text.withValues(alpha: 0.9),
                      fontSize: 16,
                      height: 1.45,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const _AddBillCameraHint(),
        ],
      ),
    );
  }
}

class _AddBillCameraHint extends StatelessWidget {
  const _AddBillCameraHint();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          'Tap the camera to get started',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: AppColors.accent,
            fontSize: 18,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.2,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Scan a receipt or enter a bill manually',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: AppColors.text.withValues(alpha: 0.85),
            fontSize: 14,
            fontWeight: FontWeight.w500,
            height: 1.35,
          ),
        ),
        const SizedBox(height: 18),
        Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            color: AppColors.accentSoft,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: AppColors.accent.withValues(alpha: 0.12),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: const Icon(
            Icons.keyboard_arrow_down_rounded,
            size: 40,
            color: AppColors.accent,
          ),
        ),
      ],
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
  String? _settlingUserId;

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
      if (mounted) {
        setState(
          () => _error = apiErrorMessage(e, 'Unable to load bill details.'),
        );
      }
    }
  }

  String _formatQuantity(double quantity) {
    if (quantity == quantity.roundToDouble()) {
      return quantity.toInt().toString();
    }
    return quantity
        .toStringAsFixed(3)
        .replaceFirst(RegExp(r'0+$'), '')
        .replaceFirst(RegExp(r'\.$'), '');
  }

  List<_ParticipantGroup> _buildParticipantGroups(Bill bill) {
    final groupedByUser = <String, _ParticipantGroup>{};
    for (final share in bill.shares) {
      groupedByUser[share.user.id] = _ParticipantGroup(
        userId: share.user.id,
        user: share.user,
        shareCents: share.shareCents,
        lenderId: share.lenderId,
        isPayer: share.user.id == bill.payerId,
        payerMarkedAsPaid: share.payerMarkedAsPaid,
        lenderConfirmedPaid: share.lenderConfirmedPaid,
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

  bool _isSoloBill(Bill bill) => bill.shares.length == 1;

  bool _hasLineItems(Bill bill) => bill.lineItems.isNotEmpty;

  bool _hasFriends(Bill bill) => bill.shares.length > 1;

  bool _showSettleUp(Bill bill, BillUserSummary? summary) {
    if (_isSoloBill(bill)) return false;
    return summary != null &&
        summary.direction != 'none' &&
        summary.amountCents > 0;
  }

  BillShare? _shareForCurrentUser(Bill bill) {
    final currentUserId = ref.read(authProvider).user?.id;
    if (currentUserId == null) return null;
    for (final share in bill.shares) {
      if (share.user.id == currentUserId) return share;
    }
    return null;
  }

  /// Returns the viewer's role for this participant row, or null if no panel.
  RequestRole? _settlementPanelRole(
    _ParticipantGroup group,
    String? currentUserId,
  ) {
    if (currentUserId == null) return null;
    if (group.isPayer || group.shareCents <= 0) return null;
    if (group.lenderId == currentUserId) return RequestRole.lender;
    if (group.userId == currentUserId && group.lenderId != currentUserId) {
      return RequestRole.debtor;
    }
    return null;
  }

  bool _showTotalsSection(Bill bill) {
    if (_hasFriends(bill) && !_hasLineItems(bill)) return false;
    return _hasLineItems(bill) || !_isSoloBill(bill);
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 4),
      child: Center(
        child: Text(
          title,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            color: AppColors.textH,
            letterSpacing: -0.2,
          ),
        ),
      ),
    );
  }

  Widget _buildTotalsBreakdownRow({
    required String label,
    required int valueCents,
    bool muted = false,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                color: muted ? AppColors.text : AppColors.textH,
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
          ),
          Text(
            formatCad(valueCents),
            style: TextStyle(
              color: muted ? AppColors.text : AppColors.textH,
              fontWeight: FontWeight.w700,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildItemizedTotalsCard(Bill bill) {
    final lineItems = [...bill.lineItems]
      ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    final otherFeesCents = bill.otherFeesCents ?? 0;
    final subtotalCents = bill.subtotalCents ??
        lineItems.fold<int>(0, (sum, item) => sum + item.totalPriceCents);

    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: AppColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < lineItems.length; i++) ...[
              if (i > 0)
                const Divider(height: 20, thickness: 1, color: AppColors.border),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          lineItems[i].name,
                          style: const TextStyle(
                            color: AppColors.textH,
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${_formatQuantity(lineItems[i].quantity)} × ${formatCad(lineItems[i].unitPriceCents)}',
                          style: const TextStyle(
                            color: AppColors.text,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    formatCad(lineItems[i].totalPriceCents),
                    style: const TextStyle(
                      color: AppColors.textH,
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                    ),
                  ),
                ],
              ),
            ],
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Divider(height: 1, thickness: 1, color: AppColors.border),
            ),
            _buildTotalsBreakdownRow(
              label: 'Subtotal',
              valueCents: subtotalCents,
            ),
            if (otherFeesCents > 0)
              _buildTotalsBreakdownRow(
                label: 'Other fees',
                valueCents: otherFeesCents,
                muted: true,
              ),
            _buildTotalsBreakdownRow(
              label: 'Tax',
              valueCents: bill.taxCents ?? 0,
              muted: true,
            ),
            _buildTotalsBreakdownRow(
              label: 'Tip',
              valueCents: bill.tipCents ?? 0,
              muted: true,
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.accentSoft,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.accent.withValues(alpha: 0.25),
                ),
              ),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Total',
                      style: TextStyle(
                        color: AppColors.textH,
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                  ),
                  Text(
                    formatCad(bill.totalCents),
                    style: const TextStyle(
                      color: AppColors.textH,
                      fontWeight: FontWeight.w800,
                      fontSize: 18,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
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

  Future<void> _markParticipantPaid(
    Bill bill,
    _ParticipantGroup group,
    RequestRole role,
  ) async {
    setState(() => _settlingUserId = group.userId);
    try {
      if (role == RequestRole.debtor) {
        await ref.read(billsApiProvider).settleBill(bill.id);
      } else {
        await ref
            .read(billsApiProvider)
            .settleBill(bill.id, participantUserId: group.userId);
      }
      notifyDataChanged(ref);
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              role == RequestRole.debtor
                  ? 'Marked as paid.'
                  : '${displayName(group.user)} marked as paid.',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              apiErrorMessage(e, 'Unable to update payment status.'),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _settlingUserId = null);
    }
  }

  Future<void> _deleteBill(Bill bill) async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Delete bill',
      message:
          'Delete "${bill.description}"? This permanently removes the bill for every participant and cannot be undone.',
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

  Widget _buildPayerBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.accentSoft,
        borderRadius: BorderRadius.circular(999),
      ),
      child: const Text(
        'paid by payer',
        style: TextStyle(
          color: AppColors.accent,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _buildShareTrailing(_ParticipantGroup group) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (group.isPayer) ...[
          _buildPayerBadge(),
          const SizedBox(width: 8),
        ],
        Text(
          formatCad(group.shareCents),
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ],
    );
  }

  Widget? _buildSettlementPanel(
    Bill bill,
    _ParticipantGroup group,
    String? currentUserId,
  ) {
    final role = _settlementPanelRole(group, currentUserId);
    if (role == null) return null;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      child: RequestSettlementStatusPanel(
        payerMarkedAsPaid: group.payerMarkedAsPaid,
        lenderConfirmedPaid: group.lenderConfirmedPaid,
        role: role,
        isSettling: _settlingUserId == group.userId,
        embedInCard: false,
        onMarkPaid: () => _markParticipantPaid(bill, group, role),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(dataRefreshProvider, (previous, next) => _load());
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
                  if (bill.isSplitWithGroup && bill.group != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Group · ${bill.group!.name}',
                      style: const TextStyle(
                        color: AppColors.accent,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
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
                          Eyebrow(
                            bill.source == BillSource.capture
                                ? 'Captured receipt'
                                : 'Manual bill',
                          ),
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
                          if (_showSettleUp(bill, summary) &&
                              summary != null) ...[
                            const SizedBox(height: 12),
                            Builder(
                              builder: (context) {
                                final ownShare = _shareForCurrentUser(bill);
                                final ownPending = ownShare != null &&
                                    summary.direction == 'you_owe' &&
                                    !summary.settled &&
                                    ownShare.payerMarkedAsPaid &&
                                    !ownShare.lenderConfirmedPaid;
                                final background = summary.settled
                                    ? AppColors.surfaceMuted
                                    : ownPending
                                    ? AppColors.pendingBg
                                    : summary.direction == 'owed_to_you'
                                    ? AppColors.accentSoft
                                    : AppColors.errorBg;
                                final message = summary.direction ==
                                        'owed_to_you'
                                    ? (summary.settled
                                          ? 'Fully paid ${formatCad(summary.amountCents)}'
                                          : 'Still owed ${formatCad(summary.amountCents)}')
                                    : summary.direction == 'you_owe'
                                    ? (summary.settled
                                          ? 'You are fully paid up'
                                          : ownPending
                                          ? 'Paid - pending confirmation from ${displayName(bill.payer)}'
                                          : 'You owe ${formatCad(summary.amountCents)}')
                                    : 'No outstanding balance';
                                final textColor = summary.settled
                                    ? AppColors.text
                                    : ownPending
                                    ? AppColors.pendingText
                                    : summary.direction == 'owed_to_you'
                                    ? AppColors.accent
                                    : AppColors.error;
                                return Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 10,
                                  ),
                                  decoration: BoxDecoration(
                                    color: background,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Text(
                                    message,
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      color: textColor,
                                    ),
                                  ),
                                );
                              },
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  if (_hasFriends(bill) ||
                      (_hasLineItems(bill) && bill.isOneMainTotal)) ...[
                    if (_hasFriends(bill)) ...[
                      _buildSectionTitle('Split by person'),
                      if (_hasLineItems(bill) && !bill.isSplitByFinalAmounts)
                        const SizedBox(
                          width: double.infinity,
                          child: Padding(
                            padding: EdgeInsets.only(bottom: 4),
                            child: Text(
                              'Tap a person\'s name to see items.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: AppColors.text,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ),
                      const SizedBox(height: 8),
                    ] else if (_hasLineItems(bill)) ...[
                      _buildSectionTitle('Line items'),
                      const SizedBox(height: 8),
                    ],
                    ..._buildParticipantGroups(bill).map((group) {
                      final currentUserId = ref.watch(authProvider).user?.id;
                      final expanded = _expandedParticipantIds.contains(
                        group.userId,
                      );
                      final itemsSubtotalCents = group.items.fold<int>(
                        0,
                        (sum, item) =>
                            sum +
                            lineItemShareForUser(
                              item.totalPriceCents,
                              item.assignments
                                  .map((a) => a.user.id)
                                  .toList(),
                              group.userId,
                            ),
                      );
                      final deltaCents = group.shareCents - itemsSubtotalCents;
                      final useExpandableTiles = _hasFriends(bill) &&
                          _hasLineItems(bill) &&
                          !bill.isSplitByFinalAmounts;
                      final settlementPanel = _buildSettlementPanel(
                        bill,
                        group,
                        currentUserId,
                      );

                      if (!useExpandableTiles &&
                          _isSoloBill(bill) &&
                          _hasLineItems(bill)) {
                        return Column(
                          children: group.items
                              .map(
                                (item) => Card(
                                  margin: const EdgeInsets.only(bottom: 8),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(14),
                                    side: const BorderSide(
                                      color: AppColors.border,
                                    ),
                                  ),
                                  child: ListTile(
                                    title: Text(item.name),
                                    subtitle: Text(
                                      '${_formatQuantity(item.quantity)} × ${formatCad(item.unitPriceCents)}',
                                    ),
                                    trailing: Text(
                                      formatCad(item.totalPriceCents),
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                ),
                              )
                              .toList(),
                        );
                      }

                      if (!useExpandableTiles) {
                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                            side: const BorderSide(color: AppColors.border),
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              ListTile(
                                title: Text(
                                  displayName(group.user),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                trailing: _buildShareTrailing(group),
                              ),
                              ?settlementPanel,
                            ],
                          ),
                        );
                      }

                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                          side: const BorderSide(color: AppColors.border),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            ExpansionTile(
                              key: ValueKey(
                                'participant-${group.userId}-$expanded',
                              ),
                              initiallyExpanded: expanded,
                              onExpansionChanged: (_) =>
                                  _toggleParticipant(group.userId),
                              title: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      displayName(group.user),
                                      style: const TextStyle(
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
                              trailing: _buildShareTrailing(group),
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
                                  ...group.items.map((item) {
                                    final isShared =
                                        item.assignments.length > 1;
                                    final userPortionCents =
                                        lineItemShareForUser(
                                      item.totalPriceCents,
                                      item.assignments
                                          .map((a) => a.user.id)
                                          .toList(),
                                      group.userId,
                                    );
                                    return ListTile(
                                      dense: true,
                                      title: Text(item.name),
                                      subtitle: Text(
                                        '${_formatQuantity(item.quantity)} × ${formatCad(item.unitPriceCents)}${isShared ? ' · shared by ${item.assignments.length}' : ''}',
                                      ),
                                      trailing: Text(
                                        formatCad(userPortionCents),
                                      ),
                                    );
                                  }),
                                Padding(
                                  padding:
                                      const EdgeInsets.fromLTRB(16, 0, 16, 12),
                                  child: Text(
                                    'Items subtotal ${formatCad(itemsSubtotalCents)}${deltaCents == 0 ? '' : ' · final share differs by ${formatCad(deltaCents.abs())} due to tax/fees/tip allocation'}',
                                    style: const TextStyle(color: AppColors.text),
                                  ),
                                ),
                              ],
                            ),
                            ?settlementPanel,
                          ],
                        ),
                      );
                    }),
                  ],
                  if (_showTotalsSection(bill)) ...[
                    const SizedBox(height: 8),
                    _buildSectionTitle('Totals'),
                    const SizedBox(height: 8),
                    if (!bill.isOneMainTotal && bill.lineItems.isNotEmpty)
                      _buildItemizedTotalsCard(bill)
                    else
                      Text(
                        'Subtotal ${formatCad(bill.subtotalCents ?? 0)}${(bill.otherFeesCents ?? 0) > 0 ? ' • Fees ${formatCad(bill.otherFeesCents!)}' : ''} • Tax ${formatCad(bill.taxCents ?? 0)} • Tip ${formatCad(bill.tipCents ?? 0)}',
                        style: const TextStyle(color: AppColors.text),
                      ),
                  ],
                  const SizedBox(height: 16),
                  if (bill.storeName != null || bill.paymentMethod != null) ...[
                    _buildSectionTitle('Receipt details'),
                    const SizedBox(height: 8),
                    if (bill.storeName != null)
                      Text('Store: ${bill.storeName}'),
                    if (bill.storeAddress != null)
                      Text('Address: ${bill.storeAddress}'),
                    if (bill.receiptNumber != null)
                      Text('Receipt #: ${bill.receiptNumber}'),
                    if (bill.receiptDate != null)
                      Text('Date: ${bill.receiptDate}'),
                    if (bill.receiptTime != null)
                      Text('Time: ${bill.receiptTime}'),
                    if (bill.paymentMethod != null)
                      Text(
                        'Payment: ${bill.paymentMethod}${bill.cardLast4 != null ? ' •••• ${bill.cardLast4}' : ''}',
                      ),
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
    required this.lenderId,
    required this.isPayer,
    required this.payerMarkedAsPaid,
    required this.lenderConfirmedPaid,
    required this.items,
  });

  final String userId;
  final User user;
  final int shareCents;
  final String lenderId;
  final bool isPayer;
  final bool payerMarkedAsPaid;
  final bool lenderConfirmedPaid;
  final List<BillLineItem> items;

  _ParticipantGroup copyWith({List<BillLineItem>? items}) {
    return _ParticipantGroup(
      userId: userId,
      user: user,
      shareCents: shareCents,
      lenderId: lenderId,
      isPayer: isPayer,
      payerMarkedAsPaid: payerMarkedAsPaid,
      lenderConfirmedPaid: lenderConfirmedPaid,
      items: items ?? this.items,
    );
  }
}
