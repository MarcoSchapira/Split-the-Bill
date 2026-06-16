import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../api/api_exception.dart';
import '../../models/models.dart';
import '../../models/user.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../common_widgets.dart';
import '../modals/bill_form_sheet.dart';

class BillList extends ConsumerWidget {
  const BillList({
    super.key,
    required this.bills,
    required this.onChanged,
    this.friend,
    this.emptyMessage = 'No bills yet.',
  });

  final List<Bill> bills;
  final VoidCallback onChanged;
  final User? friend;
  final String emptyMessage;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (bills.isEmpty) {
      return EmptyState(message: emptyMessage);
    }

    return Column(
      children: bills.map((bill) {
        return _BillListItem(
          bill: bill,
          friend: friend,
          onChanged: onChanged,
        );
      }).toList(),
    );
  }
}

class _BillListItem extends ConsumerStatefulWidget {
  const _BillListItem({
    required this.bill,
    required this.onChanged,
    this.friend,
  });

  final Bill bill;
  final User? friend;
  final VoidCallback onChanged;

  @override
  ConsumerState<_BillListItem> createState() => _BillListItemState();
}

class _BillListItemState extends ConsumerState<_BillListItem> {
  bool _expanded = false;

  Future<void> _delete() async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Delete bill',
      message: 'Delete "${widget.bill.description}"? This cannot be undone.',
    );
    if (confirmed != true) return;

    try {
      await ref.read(billsApiProvider).deleteBill(widget.bill.id);
      notifyDataChanged(ref);
      widget.onChanged();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(apiErrorMessage(e, 'Unable to delete bill.'))),
        );
      }
    }
  }

  Future<void> _edit() async {
    await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => BillFormSheet(
        bill: widget.bill,
        fixedTarget: BillTarget(
          targetType: widget.bill.targetType,
          targetId: widget.bill.friendshipId ?? widget.bill.groupId ?? '',
        ),
        onSaved: widget.onChanged,
      ),
    );
  }

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
        ? 'owes you'
        : summary.direction == 'you_owe'
            ? 'you owe'
            : null;
    final balanceColor = summary.direction == 'owed_to_you'
        ? AppColors.accent
        : summary.direction == 'you_owe'
            ? AppColors.error
            : AppColors.text;
    final titleStyle = TextStyle(
      fontWeight: FontWeight.w700,
      decoration: isSettled ? TextDecoration.lineThrough : null,
      color: isSettled ? AppColors.text.withValues(alpha: 0.55) : null,
    );

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Column(
        children: [
          ListTile(
            onTap: () => setState(() => _expanded = !_expanded),
            title: Text(bill.description, style: titleStyle),
            trailing: showBalance
                ? Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      if (balanceLabel != null)
                        Text(
                          balanceLabel,
                          style: TextStyle(
                            color: isSettled
                                ? AppColors.text.withValues(alpha: 0.55)
                                : balanceColor,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      Text(
                        formatCad(summary.amountCents),
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                          color: isSettled
                              ? AppColors.text.withValues(alpha: 0.55)
                              : balanceColor,
                          decoration: isSettled ? TextDecoration.lineThrough : null,
                        ),
                      ),
                    ],
                  )
                : null,
          ),
          if (showBalance && !isSettled || bill.canEdit || bill.canDelete)
            Padding(
              padding: const EdgeInsets.only(left: 16, right: 16, bottom: 8),
              child: Row(
                children: [
                  if (showBalance && !isSettled)
                    TextButton(onPressed: _settle, child: const Text('Settle up')),
                  const Spacer(),
                  if (bill.canEdit)
                    TextButton(onPressed: _edit, child: const Text('Edit')),
                  if (bill.canDelete)
                    TextButton(
                      onPressed: _delete,
                      style: TextButton.styleFrom(foregroundColor: AppColors.error),
                      child: const Text('Delete'),
                    ),
                ],
              ),
            ),
          if (_expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Total',
                        style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.text),
                      ),
                      Text(
                        formatCad(bill.totalCents),
                        style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.text),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Paid by ${displayName(bill.payer)} on ${formatDateUtc(bill.incurredAt)}',
                    style: const TextStyle(color: AppColors.text),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Split breakdown',
                    style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.text),
                  ),
                  const SizedBox(height: 8),
                  ...shares.map(
                    (share) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(displayName(share.user)),
                          Text(formatCad(share.shareCents)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
