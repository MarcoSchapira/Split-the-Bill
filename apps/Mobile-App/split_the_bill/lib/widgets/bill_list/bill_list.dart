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
    final shares = [...bill.shares]
      ..sort((a, b) => displayName(a.user).compareTo(displayName(b.user)));
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

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: () => context.push('/bills/${bill.id}'),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: isCapture ? AppColors.accentSoft : AppColors.surfaceMuted,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      isCapture ? Icons.receipt_long_outlined : Icons.edit_note_outlined,
                      color: isCapture ? AppColors.accent : AppColors.text,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          bill.description,
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 16,
                            color: isSettled
                                ? AppColors.text.withValues(alpha: 0.55)
                                : AppColors.textH,
                            decoration: isSettled ? TextDecoration.lineThrough : null,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${formatDateUtc(bill.incurredAt)} · Paid by ${displayName(bill.payer)}',
                          style: const TextStyle(color: AppColors.text, fontSize: 13),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Text(
                              formatCad(bill.totalCents),
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                color: AppColors.textH,
                                fontSize: 13,
                              ),
                            ),
                            if (isSettled) ...[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceMuted,
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: const Text(
                                  'Settled',
                                  style: TextStyle(
                                    color: AppColors.text,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                  if (widget.showBalanceSummary && showBalance)
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        if (balanceLabel != null)
                          Text(
                            balanceLabel,
                            style: TextStyle(
                              color: isSettled
                                  ? AppColors.text.withValues(alpha: 0.55)
                                  : balanceColor,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        const SizedBox(height: 2),
                        Text(
                          formatCad(summary.amountCents),
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 17,
                            color: isSettled
                                ? AppColors.text.withValues(alpha: 0.55)
                                : balanceColor,
                            decoration: isSettled ? TextDecoration.lineThrough : null,
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ),
          ),
            if ((showBalance && !isSettled && widget.showSettleAction) ||
                shares.length > 1)
              Container(
                decoration: const BoxDecoration(
                  border: Border(top: BorderSide(color: AppColors.border)),
                  color: AppColors.surfaceMuted,
                ),
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                child: Row(
                  children: [
                    if (shares.length > 1)
                      Expanded(
                        child: Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: () => setState(() => _expanded = !_expanded),
                            borderRadius: BorderRadius.circular(8),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                              child: Row(
                                children: [
                                  AnimatedRotation(
                                    turns: _expanded ? 0.5 : 0,
                                    duration: const Duration(milliseconds: 200),
                                    curve: Curves.easeInOut,
                                    child: const Icon(
                                      Icons.keyboard_arrow_down,
                                      color: AppColors.text,
                                    ),
                                  ),
                                  const SizedBox(width: 4),
                                  const Text(
                                    'Split breakdown',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.textH,
                                      fontSize: 13,
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
                          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
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
                  ? Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () => setState(() => _expanded = false),
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              ...shares.map(
                                (share) => Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 4),
                                  child: Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          displayName(share.user),
                                          style: const TextStyle(color: AppColors.text, fontSize: 13),
                                        ),
                                      ),
                                      Text(
                                        formatCad(share.shareCents),
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                          color: AppColors.textH,
                                          fontSize: 13,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    )
                  : const SizedBox(width: double.infinity),
            ),
        ],
      ),
    );
  }
}
