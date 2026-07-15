import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../../utils/settlement_status.dart';
import '../common_widgets.dart';

class BillList extends ConsumerWidget {
  const BillList({
    super.key,
    required this.bills,
    this.emptyMessage = 'No bills yet.',
  });

  final List<Bill> bills;
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

BillShare? _shareForUser(Bill bill, String? userId) {
  if (userId == null) return null;
  for (final share in bill.shares) {
    if (share.user.id == userId) {
      return share;
    }
  }
  return null;
}

int? _yourShareCents(Bill bill, String? currentUserId) {
  return _shareForUser(bill, currentUserId)?.shareCents;
}

enum _BillTileStatus {
  solo,
  payerCollecting,
  payerComplete,
  debtorOwes,
  debtorPending,
  debtorSettled,
}

_BillTileStatus _billTileStatus({
  required bool isPayer,
  required bool isSoloBill,
  required BillSettlementState? userShareState,
  required bool allDebtorsSettled,
  required int debtorCount,
}) {
  if (isSoloBill) return _BillTileStatus.solo;
  if (isPayer) {
    return allDebtorsSettled || debtorCount == 0
        ? _BillTileStatus.payerComplete
        : _BillTileStatus.payerCollecting;
  }
  return switch (userShareState) {
    BillSettlementState.settled => _BillTileStatus.debtorSettled,
    BillSettlementState.pending => _BillTileStatus.debtorPending,
    BillSettlementState.unpaid || null => _BillTileStatus.debtorOwes,
  };
}

class _BillListItem extends ConsumerWidget {
  const _BillListItem({
    super.key,
    required this.bill,
  });

  final Bill bill;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shares = _sortedShares(bill);
    final currentUserId = ref.watch(authProvider).user?.id;
    final yourShareCents = _yourShareCents(bill, currentUserId);
    final isPayer =
        currentUserId != null && currentUserId == bill.payerId;
    final isSoloBill = !bill.isSplitWithFriends || shares.length <= 1;
    final multiParticipant = shares.length > 1;
    final debtorShares = billDebtorShares(bill);
    final debtorCount = debtorShares.length;
    final settledDebtorCount = billSettledDebtorCount(debtorShares);
    final pendingDebtorCount = billPendingDebtorCount(debtorShares);
    final unpaidDebtorCount = billUnpaidDebtorCount(debtorShares);
    final allDebtorsSettled = billAllDebtorsSettled(debtorShares);
    final amountOwedToPayer = billAmountStillOwedToPayer(debtorShares);
    final debtorProgress = billDebtorProgress(debtorShares);
    final userShare = _shareForUser(bill, currentUserId);
    final userShareState = userShare == null
        ? null
        : billShareSettlementState(userShare, payerId: bill.payerId);
    final userOwesAmount = userShare?.shareCents ?? 0;
    final tileStatus = _billTileStatus(
      isPayer: isPayer,
      isSoloBill: isSoloBill,
      userShareState: userShareState,
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
      child: InkWell(
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
                  _BillTileStatus.debtorPending => userOwesAmount,
                  _BillTileStatus.debtorSettled => userOwesAmount,
                },
                payerName: displayName(bill.payer),
                settledDebtorCount: settledDebtorCount,
                pendingDebtorCount: pendingDebtorCount,
                unpaidDebtorCount: unpaidDebtorCount,
                debtorCount: debtorCount,
                debtorProgress: debtorProgress,
              ),
            ],
          ),
        ),
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
    required this.pendingDebtorCount,
    required this.unpaidDebtorCount,
    required this.debtorCount,
    required this.debtorProgress,
  });

  final _BillTileStatus status;
  final int amountCents;
  final String payerName;
  final int settledDebtorCount;
  final int pendingDebtorCount;
  final int unpaidDebtorCount;
  final int debtorCount;
  final double debtorProgress;

  @override
  Widget build(BuildContext context) {
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
          subtitle: billPayerCollectingSubtitle(
            unpaidCount: unpaidDebtorCount,
            pendingCount: pendingDebtorCount,
          ),
          titleColor: AppColors.textH,
          showProgress: true,
          trailing: pendingDebtorCount > 0
              ? '$settledDebtorCount/$debtorCount paid · $pendingDebtorCount pending'
              : '$settledDebtorCount/$debtorCount paid',
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
      _BillTileStatus.debtorPending => (
          background: AppColors.pendingBg,
          border: AppColors.pendingText.withValues(alpha: 0.25),
          iconBg: AppColors.surface,
          iconColor: AppColors.pendingText,
          icon: Icons.hourglass_top_rounded,
          eyebrow: 'Paid - pending',
          title: formatCad(amountCents),
          subtitle: 'Awaiting confirmation from $payerName',
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
                                status == _BillTileStatus.debtorPending ||
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
