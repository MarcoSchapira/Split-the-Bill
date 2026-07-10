import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../api/api_exception.dart';
import '../../models/models.dart';
import '../../models/user.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../common_widgets.dart';

class BillList extends ConsumerWidget {
  const BillList({
    super.key,
    required this.bills,
    required this.onChanged,
    this.friend,
    this.showSettleAction = true,
    this.showBalanceSummary = true,
    this.emptyMessage = 'No bills yet.',
  });

  final List<Bill> bills;
  final VoidCallback onChanged;
  final User? friend;
  final bool showSettleAction;
  final bool showBalanceSummary;
  final String emptyMessage;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (bills.isEmpty) {
      return Card(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: AppColors.border),
        ),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: EmptyState(message: emptyMessage),
        ),
      );
    }

    return Column(
      children: bills.map((bill) {
        return _BillListItem(
          key: ValueKey(bill.id),
          bill: bill,
          friend: friend,
          onChanged: onChanged,
          showSettleAction: showSettleAction,
          showBalanceSummary: showBalanceSummary,
        );
      }).toList(),
    );
  }
}

List<BillShare> _sortedShares(Bill bill) {
  final shares = [...bill.shares];
  shares.sort((left, right) {
    final leftIsPayer = left.user.id == bill.payerId;
    final rightIsPayer = right.user.id == bill.payerId;
    if (leftIsPayer && !rightIsPayer) return -1;
    if (!leftIsPayer && rightIsPayer) return 1;
    return right.shareCents.compareTo(left.shareCents);
  });
  return shares;
}

bool _isShareSettled(BillShare share, String payerId) {
  if (share.user.id == payerId) return true;
  return share.settlementStatus == 'PAID' || share.settledAt != null;
}

int _settledShareCount(Bill bill) {
  return bill.shares
      .where((share) => _isShareSettled(share, bill.payerId))
      .length;
}

bool _isBillFullySettled(Bill bill) {
  return bill.shares.every((share) => _isShareSettled(share, bill.payerId));
}

String _nameInitial(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return '?';
  return trimmed[0].toUpperCase();
}

class _BillListItem extends ConsumerStatefulWidget {
  const _BillListItem({
    super.key,
    required this.bill,
    required this.onChanged,
    this.friend,
    required this.showSettleAction,
    required this.showBalanceSummary,
  });

  final Bill bill;
  final User? friend;
  final VoidCallback onChanged;
  final bool showSettleAction;
  final bool showBalanceSummary;

  @override
  ConsumerState<_BillListItem> createState() => _BillListItemState();
}

class _BillListItemState extends ConsumerState<_BillListItem> {
  bool _expanded = false;

  Future<void> _settle() async {
    try {
      await ref.read(billsApiProvider).settleBill(
            widget.bill.id,
            friendUserId: widget.friend?.id,
          );
      notifyDataChanged(ref);
      widget.onChanged();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(apiErrorMessage(e, 'Unable to settle this bill.'))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bill = widget.bill;
    final shares = _sortedShares(bill);
    final summary = bill.userSummary;
    final showBalance = summary.direction != 'none' && summary.amountCents > 0;
    final isSettled = summary.settled;
    final balanceLabel = summary.direction == 'owed_to_you'
        ? 'Owes you'
        : summary.direction == 'you_owe'
            ? 'You owe'
            : null;
    final balanceColor = summary.direction == 'owed_to_you'
        ? AppColors.accent
        : summary.direction == 'you_owe'
            ? AppColors.error
            : AppColors.text;
    final isCapture = bill.source == BillSource.capture;
    final multiParticipant = shares.length > 1;
    final fullySettled = _isBillFullySettled(bill);
    final settledCount = _settledShareCount(bill);
    final settlementProgress =
        shares.isEmpty ? 0.0 : settledCount / shares.length;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      clipBehavior: Clip.antiAlias,
      elevation: 0,
      color: AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: fullySettled ? AppColors.border : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: () => context.push('/bills/${bill.id}'),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          bill.description,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 16,
                            height: 1.25,
                            color: AppColors.textH,
                          ),
                        ),
                      ),
                      if (widget.showBalanceSummary && showBalance)
                        Padding(
                          padding: const EdgeInsets.only(left: 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              if (balanceLabel != null)
                                Text(
                                  balanceLabel,
                                  style: TextStyle(
                                    color: isSettled
                                        ? AppColors.text
                                        : balanceColor,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              Text(
                                formatCad(summary.amountCents),
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 17,
                                  color: isSettled
                                      ? AppColors.text
                                      : balanceColor,
                                  decoration: isSettled
                                      ? TextDecoration.lineThrough
                                      : null,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      _BillMetaChip(
                        icon: isCapture
                            ? Icons.receipt_long_outlined
                            : Icons.edit_note_outlined,
                        label: isCapture ? 'Captured' : 'Manual',
                        foreground: isCapture
                            ? AppColors.accent
                            : AppColors.text,
                        background: isCapture
                            ? AppColors.accentSoft
                            : AppColors.surfaceMuted,
                      ),
                      _BillMetaChip(
                        icon: Icons.calendar_today_outlined,
                        label: formatDateUtc(bill.incurredAt),
                      ),
                      if (multiParticipant)
                        _BillMetaChip(
                          icon: Icons.group_outlined,
                          label: '${shares.length} people',
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Paid by ${displayName(bill.payer)}',
                    style: const TextStyle(
                      color: AppColors.text,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        formatCad(bill.totalCents),
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          color: AppColors.textH,
                          fontSize: 22,
                          height: 1,
                        ),
                      ),
                      const Spacer(),
                      if (multiParticipant)
                        _SettlementSummaryBadge(
                          settledCount: settledCount,
                          totalCount: shares.length,
                          fullySettled: fullySettled,
                        )
                      else if (fullySettled)
                        const _SettlementSummaryBadge(
                          settledCount: 1,
                          totalCount: 1,
                          fullySettled: true,
                        ),
                    ],
                  ),
                  if (multiParticipant) ...[
                    const SizedBox(height: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(
                        value: settlementProgress,
                        minHeight: 5,
                        backgroundColor: AppColors.surfaceMuted,
                        color: fullySettled
                            ? AppColors.accent
                            : AppColors.brandSoft,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          if ((showBalance && !isSettled && widget.showSettleAction) ||
              multiParticipant)
            Container(
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: AppColors.border)),
                color: AppColors.surfaceMuted,
              ),
              padding: const EdgeInsets.fromLTRB(8, 4, 8, 4),
              child: Row(
                children: [
                  if (multiParticipant)
                    Expanded(
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () => setState(() => _expanded = !_expanded),
                          borderRadius: BorderRadius.circular(10),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 10,
                            ),
                            child: Row(
                              children: [
                                AnimatedRotation(
                                  turns: _expanded ? 0.5 : 0,
                                  duration: const Duration(milliseconds: 200),
                                  curve: Curves.easeInOut,
                                  child: const Icon(
                                    Icons.keyboard_arrow_down_rounded,
                                    color: AppColors.textH,
                                    size: 22,
                                  ),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  _expanded
                                      ? 'Hide split'
                                      : 'Split breakdown',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.textH,
                                    fontSize: 13,
                                  ),
                                ),
                                const Spacer(),
                                if (!_expanded)
                                  Text(
                                    '$settledCount/${shares.length} settled',
                                    style: const TextStyle(
                                      color: AppColors.text,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    )
                  else
                    const Spacer(),
                  if (showBalance && !isSettled && widget.showSettleAction)
                    TextButton.icon(
                      onPressed: _settle,
                      icon: const Icon(Icons.check_circle_outline, size: 18),
                      label: const Text('Settle up'),
                      style: TextButton.styleFrom(
                        foregroundColor: AppColors.accent,
                        textStyle: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          AnimatedSize(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeInOut,
            alignment: Alignment.topCenter,
            clipBehavior: Clip.hardEdge,
            child: _expanded
                ? Padding(
                    padding: const EdgeInsets.fromLTRB(12, 4, 12, 14),
                    child: Column(
                      children: [
                        for (var i = 0; i < shares.length; i++) ...[
                          if (i > 0) const SizedBox(height: 6),
                          _ShareBreakdownRow(
                            share: shares[i],
                            payerId: bill.payerId,
                          ),
                        ],
                      ],
                    ),
                  )
                : const SizedBox(width: double.infinity),
          ),
        ],
      ),
    );
  }
}

class _BillMetaChip extends StatelessWidget {
  const _BillMetaChip({
    required this.icon,
    required this.label,
    this.foreground = AppColors.text,
    this.background = AppColors.surfaceMuted,
  });

  final IconData icon;
  final String label;
  final Color foreground;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: foreground),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: foreground,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _SettlementSummaryBadge extends StatelessWidget {
  const _SettlementSummaryBadge({
    required this.settledCount,
    required this.totalCount,
    required this.fullySettled,
  });

  final int settledCount;
  final int totalCount;
  final bool fullySettled;

  @override
  Widget build(BuildContext context) {
    final (background, foreground, icon, label) = fullySettled
        ? (
            AppColors.accentSoft,
            AppColors.accent,
            Icons.check_circle_rounded,
            totalCount == 1 ? 'Settled' : 'All settled',
          )
        : (
            AppColors.pendingBg,
            AppColors.pendingText,
            Icons.hourglass_top_rounded,
            '$settledCount of $totalCount settled',
          );

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: foreground),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: foreground,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _ShareBreakdownRow extends StatelessWidget {
  const _ShareBreakdownRow({
    required this.share,
    required this.payerId,
  });

  final BillShare share;
  final String payerId;

  @override
  Widget build(BuildContext context) {
    final name = displayName(share.user);
    final isPayer = share.user.id == payerId;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor:
                isPayer ? AppColors.accentSoft : AppColors.surfaceMuted,
            child: Text(
              _nameInitial(name),
              style: TextStyle(
                color: isPayer ? AppColors.accent : AppColors.textH,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: AppColors.textH,
                    fontSize: 14,
                  ),
                ),
                if (isPayer)
                  const Text(
                    'Paid the bill',
                    style: TextStyle(
                      color: AppColors.text,
                      fontSize: 12,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          _ShareSettlementBadge(share: share, isPayer: isPayer),
          const SizedBox(width: 10),
          Text(
            formatCad(share.shareCents),
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              color: AppColors.textH,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }
}

class _ShareSettlementBadge extends StatelessWidget {
  const _ShareSettlementBadge({
    required this.share,
    required this.isPayer,
  });

  final BillShare share;
  final bool isPayer;

  @override
  Widget build(BuildContext context) {
    final (background, foreground, label) = switch ((isPayer, share.settlementStatus)) {
      (true, _) => (AppColors.accentSoft, AppColors.accent, 'Payer'),
      (_, 'PAID') => (AppColors.accentSoft, AppColors.accent, 'Paid'),
      (_, 'PENDING') => (AppColors.pendingBg, AppColors.pendingText, 'Pending'),
      _ when share.settledAt != null =>
        (AppColors.accentSoft, AppColors.accent, 'Paid'),
      _ => (AppColors.errorBg, AppColors.error, 'Unpaid'),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: foreground,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.02,
        ),
      ),
    );
  }
}
