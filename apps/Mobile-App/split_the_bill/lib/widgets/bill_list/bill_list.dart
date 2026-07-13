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

/// Set to true to restore the expandable split breakdown footer on bill tiles.
const _showSplitBreakdown = false;

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
  return share.lenderConfirmedPaid;
}

List<BillShare> _debtorShares(Bill bill) {
  return bill.shares.where((share) => share.user.id != bill.payerId).toList();
}

int _settledDebtorCount(Bill bill) {
  return _debtorShares(bill)
      .where((share) => _isShareSettled(share, bill.payerId))
      .length;
}

bool _allDebtorsSettled(Bill bill) {
  final debtors = _debtorShares(bill);
  if (debtors.isEmpty) return true;
  return debtors.every((share) => _isShareSettled(share, bill.payerId));
}

int _amountOwedToPayer(Bill bill) {
  return _debtorShares(bill)
      .where((share) => !_isShareSettled(share, bill.payerId))
      .fold<int>(0, (sum, share) => sum + share.shareCents);
}

BillShare? _shareForUser(Bill bill, String? userId) {
  if (userId == null) return null;
  for (final share in bill.shares) {
    if (share.user.id == userId) {
      return share;
    }
  }
  return null;
}

String _nameInitial(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return '?';
  return trimmed[0].toUpperCase();
}

int? _yourShareCents(Bill bill, String? currentUserId) {
  return _shareForUser(bill, currentUserId)?.shareCents;
}

enum _BillTileStatus {
  solo,
  payerCollecting,
  payerComplete,
  debtorOwes,
  debtorSettled,
}

_BillTileStatus _billTileStatus({
  required Bill bill,
  required bool isPayer,
  required bool isSoloBill,
  required bool userShareSettled,
  required bool allDebtorsSettled,
  required int debtorCount,
}) {
  if (isSoloBill) return _BillTileStatus.solo;
  if (isPayer) {
    return allDebtorsSettled || debtorCount == 0
        ? _BillTileStatus.payerComplete
        : _BillTileStatus.payerCollecting;
  }
  return userShareSettled
      ? _BillTileStatus.debtorSettled
      : _BillTileStatus.debtorOwes;
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
    final currentUserId = ref.watch(authProvider).user?.id;
    final yourShareCents = _yourShareCents(bill, currentUserId);
    final isPayer =
        currentUserId != null && currentUserId == bill.payerId;
    final isSoloBill = !bill.isSplitWithFriends || shares.length <= 1;
    final multiParticipant = shares.length > 1;
    final debtorShares = _debtorShares(bill);
    final debtorCount = debtorShares.length;
    final settledDebtorCount = _settledDebtorCount(bill);
    final allDebtorsSettled = _allDebtorsSettled(bill);
    final amountOwedToPayer = _amountOwedToPayer(bill);
    final debtorProgress =
        debtorCount == 0 ? 1.0 : settledDebtorCount / debtorCount;
    final userShare = _shareForUser(bill, currentUserId);
    final userShareSettled = userShare != null &&
        _isShareSettled(userShare, bill.payerId);
    final userOwesAmount = userShare?.shareCents ?? 0;
    final tileStatus = _billTileStatus(
      bill: bill,
      isPayer: isPayer,
      isSoloBill: isSoloBill,
      userShareSettled: userShareSettled,
      allDebtorsSettled: allDebtorsSettled,
      debtorCount: debtorCount,
    );

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      clipBehavior: Clip.antiAlias,
      elevation: 0,
      color: AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.border),
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
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
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
                            const SizedBox(height: 6),
                            Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                _BillMetaChip(
                                  icon: Icons.calendar_today_outlined,
                                  label: formatDateUtc(bill.incurredAt),
                                ),
                                if (bill.isSplitWithGroup && bill.group != null)
                                  _BillMetaChip(
                                    icon: Icons.groups_outlined,
                                    label: bill.group!.name,
                                  )
                                else if (multiParticipant)
                                  _BillMetaChip(
                                    icon: Icons.group_outlined,
                                    label: '${shares.length} people',
                                  ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Paid by ${displayName(bill.payer)}',
                              style: const TextStyle(
                                color: AppColors.text,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (yourShareCents != null)
                        Padding(
                          padding: const EdgeInsets.only(left: 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              const Text(
                                'You pay',
                                style: TextStyle(
                                  color: AppColors.text,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              Text(
                                formatCad(yourShareCents),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 17,
                                  color: AppColors.textH,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _BillStatusPanel(
                    status: tileStatus,
                    amountCents: switch (tileStatus) {
                      _BillTileStatus.solo => bill.totalCents,
                      _BillTileStatus.payerCollecting => amountOwedToPayer,
                      _BillTileStatus.payerComplete => bill.totalCents,
                      _BillTileStatus.debtorOwes => userOwesAmount,
                      _BillTileStatus.debtorSettled => userOwesAmount,
                    },
                    payerName: displayName(bill.payer),
                    settledDebtorCount: settledDebtorCount,
                    debtorCount: debtorCount,
                    debtorProgress: debtorProgress,
                  ),
                ],
              ),
            ),
          ),
          if ((showBalance && !isSettled && widget.showSettleAction) ||
              (_showSplitBreakdown && multiParticipant))
            Container(
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: AppColors.border)),
                color: AppColors.surfaceMuted,
              ),
              padding: const EdgeInsets.fromLTRB(8, 4, 8, 4),
              child: Row(
                children: [
                  if (_showSplitBreakdown && multiParticipant)
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
                                if (!_expanded && isPayer && debtorCount > 0)
                                  Text(
                                    '$settledDebtorCount/$debtorCount settled',
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
          if (_showSplitBreakdown)
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

class _BillStatusPanel extends StatelessWidget {
  const _BillStatusPanel({
    required this.status,
    required this.amountCents,
    required this.payerName,
    required this.settledDebtorCount,
    required this.debtorCount,
    required this.debtorProgress,
  });

  final _BillTileStatus status;
  final int amountCents;
  final String payerName;
  final int settledDebtorCount;
  final int debtorCount;
  final double debtorProgress;

  @override
  Widget build(BuildContext context) {
    final remainingDebtorCount =
        (debtorCount - settledDebtorCount).clamp(0, debtorCount);

    final config = switch (status) {
      _BillTileStatus.solo => (
          background: AppColors.surfaceMuted,
          border: AppColors.border,
          iconBg: AppColors.surface,
          iconColor: AppColors.text,
          icon: Icons.receipt_outlined,
          eyebrow: 'Personal expense',
          title: formatCad(amountCents),
          subtitle: 'Not split with anyone',
          titleColor: AppColors.textH,
          showProgress: false,
          trailing: null,
        ),
      _BillTileStatus.payerCollecting => (
          background: AppColors.accentSoft.withValues(alpha: 0.55),
          border: AppColors.accent.withValues(alpha: 0.18),
          iconBg: AppColors.accentSoft,
          iconColor: AppColors.accent,
          icon: Icons.payments_outlined,
          eyebrow: "You're owed",
          title: formatCad(amountCents),
          subtitle: remainingDebtorCount == 1
              ? 'Waiting on 1 person to pay you back'
              : 'Waiting on $remainingDebtorCount people to pay you back',
          titleColor: AppColors.textH,
          showProgress: true,
          trailing: '$settledDebtorCount/$debtorCount paid',
        ),
      _BillTileStatus.payerComplete => (
          background: AppColors.accentSoft,
          border: AppColors.accent.withValues(alpha: 0.2),
          iconBg: AppColors.surface,
          iconColor: AppColors.accent,
          icon: Icons.check_circle_rounded,
          eyebrow: 'Fully collected',
          title: 'All paid up',
          subtitle: 'Everyone paid you back',
          titleColor: AppColors.accent,
          showProgress: false,
          trailing: null,
        ),
      _BillTileStatus.debtorOwes => (
          background: AppColors.errorBg,
          border: AppColors.errorBorder,
          iconBg: AppColors.surface,
          iconColor: AppColors.error,
          icon: Icons.arrow_outward_rounded,
          eyebrow: 'You owe',
          title: formatCad(amountCents),
          subtitle: 'Pay back to $payerName',
          titleColor: AppColors.textH,
          showProgress: false,
          trailing: null,
        ),
      _BillTileStatus.debtorSettled => (
          background: AppColors.accentSoft,
          border: AppColors.accent.withValues(alpha: 0.2),
          iconBg: AppColors.surface,
          iconColor: AppColors.accent,
          icon: Icons.check_circle_rounded,
          eyebrow: 'Your share',
          title: 'Paid up',
          subtitle: 'You settled with $payerName',
          titleColor: AppColors.accent,
          showProgress: false,
          trailing: null,
        ),
    };

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: config.background,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: config.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: config.iconBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(config.icon, color: config.iconColor, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            config.eyebrow.toUpperCase(),
                            style: TextStyle(
                              color: config.iconColor,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.06,
                            ),
                          ),
                        ),
                        if (config.trailing != null)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.surface.withValues(alpha: 0.72),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              config.trailing!,
                              style: const TextStyle(
                                color: AppColors.pendingText,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      config.title,
                      style: TextStyle(
                        color: config.titleColor,
                        fontSize: status == _BillTileStatus.solo ||
                                status == _BillTileStatus.debtorOwes ||
                                status == _BillTileStatus.payerCollecting
                            ? 24
                            : 20,
                        fontWeight: FontWeight.w800,
                        height: 1.1,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      config.subtitle,
                      style: const TextStyle(
                        color: AppColors.text,
                        fontSize: 13,
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (config.showProgress) ...[
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: debtorProgress,
                minHeight: 6,
                backgroundColor: AppColors.surface.withValues(alpha: 0.65),
                color: AppColors.accent,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _BillMetaChip extends StatelessWidget {
  const _BillMetaChip({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: AppColors.text),
          const SizedBox(width: 4),
          Text(
            label,
            style: const TextStyle(
              color: AppColors.text,
              fontSize: 11,
              fontWeight: FontWeight.w600,
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
    final (background, foreground, label) = switch ((isPayer, share.lenderConfirmedPaid, share.payerMarkedAsPaid)) {
      (true, _, _) => (AppColors.accentSoft, AppColors.accent, 'Payer'),
      (_, true, _) => (AppColors.accentSoft, AppColors.accent, 'Paid'),
      (_, false, true) => (AppColors.pendingBg, AppColors.pendingText, 'Pending'),
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
