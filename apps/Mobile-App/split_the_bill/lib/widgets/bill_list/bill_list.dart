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

  String? _pairwiseLabel() {
    final pairwise = widget.bill.pairwise;
    final friend = widget.friend;
    if (pairwise == null || friend == null) return null;

    if (pairwise.direction == 'friend_owes_you') {
      return '${displayName(friend)} owes you ${formatCad(pairwise.amountCents)}';
    }
    return 'You owe ${displayName(friend)} ${formatCad(pairwise.amountCents)}';
  }

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

  @override
  Widget build(BuildContext context) {
    final bill = widget.bill;
    final shares = [...bill.shares]
      ..sort((a, b) => displayName(a.user).compareTo(displayName(b.user)));
    final pairwiseLabel = _pairwiseLabel();

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Column(
        children: [
          ListTile(
            onTap: () => setState(() => _expanded = !_expanded),
            title: Text(bill.description, style: const TextStyle(fontWeight: FontWeight.w700)),
            subtitle: Text(
              'Paid by ${displayName(bill.payer)} on ${formatDateUtc(bill.incurredAt)}',
            ),
            trailing: Text(
              formatCad(bill.totalCents),
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
            ),
          ),
          if (bill.canEdit || bill.canDelete)
            Padding(
              padding: const EdgeInsets.only(left: 16, right: 16, bottom: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
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
                  Text(
                    pairwiseLabel != null ? 'Between you' : 'Split breakdown',
                    style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.text),
                  ),
                  const SizedBox(height: 8),
                  if (pairwiseLabel != null)
                    Text(pairwiseLabel)
                  else
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
