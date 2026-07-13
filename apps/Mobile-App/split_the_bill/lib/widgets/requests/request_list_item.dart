import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../../utils/request_items.dart';
import '../../utils/settlement_status.dart';

class RequestListItem extends StatelessWidget {
  const RequestListItem({
    super.key,
    required this.item,
    this.isSettling = false,
    this.onMarkPaid,
  });

  final RequestItem item;
  final bool isSettling;
  final VoidCallback? onMarkPaid;

  Color _directionColor(RequestDirection direction) {
    return direction == RequestDirection.owedToYou
        ? AppColors.accent
        : AppColors.error;
  }

  @override
  Widget build(BuildContext context) {
    final counterpartyName = displayName(item.counterparty);
    final progress = requestSettlementProgress(
      payerMarkedAsPaid: item.payerMarkedAsPaid,
      lenderConfirmedPaid: item.lenderConfirmedPaid,
    );
    final barColor = requestSettlementBarColor(
      payerMarkedAsPaid: item.payerMarkedAsPaid,
      lenderConfirmedPaid: item.lenderConfirmedPaid,
      role: item.role,
    );
    final statusColor = requestSettlementStatusColor(
      payerMarkedAsPaid: item.payerMarkedAsPaid,
      lenderConfirmedPaid: item.lenderConfirmedPaid,
      role: item.role,
    );
    final showAction = canShowRequestMarkPaidAction(
      payerMarkedAsPaid: item.payerMarkedAsPaid,
      lenderConfirmedPaid: item.lenderConfirmedPaid,
      role: item.role,
    );
    final showDebtorBadge = showDebtorMarkedBadge(
      payerMarkedAsPaid: item.payerMarkedAsPaid,
      lenderConfirmedPaid: item.lenderConfirmedPaid,
      role: item.role,
    );
    final directionColor = _directionColor(item.direction);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: AppColors.textH.withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: () => context.push('/bills/${item.billId}'),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.billLabel,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            height: 1.25,
                            color: AppColors.textH,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          counterpartyName,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textH,
                          ),
                        ),
                        const SizedBox(height: 8),
                        _MetaChip(
                          icon: Icons.calendar_today_outlined,
                          label: formatDateUtc(item.incurredAt),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        requestAmountDirectionLabel(item.direction).toUpperCase(),
                        style: TextStyle(
                          color: directionColor.withValues(alpha: 0.82),
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.08,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        formatCad(item.amountCents),
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w800,
                          height: 1,
                          color: directionColor,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          _RequestStatusPanel(
            progress: progress,
            barColor: barColor,
            statusColor: statusColor,
            statusLabel: requestSettlementStatusLabel(
              payerMarkedAsPaid: item.payerMarkedAsPaid,
              lenderConfirmedPaid: item.lenderConfirmedPaid,
              role: item.role,
            ),
            showAction: showAction,
            showDebtorBadge: showDebtorBadge,
            showCheckmark: item.lenderConfirmedPaid,
            actionLabel: requestMarkPaidActionLabel(item.role),
            isSettling: isSettling,
            onMarkPaid: onMarkPaid,
            role: item.role,
          ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.label});

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

class _RequestStatusPanel extends StatelessWidget {
  const _RequestStatusPanel({
    required this.progress,
    required this.barColor,
    required this.statusColor,
    required this.statusLabel,
    required this.showAction,
    required this.showDebtorBadge,
    required this.showCheckmark,
    required this.actionLabel,
    required this.isSettling,
    required this.onMarkPaid,
    required this.role,
  });

  final double progress;
  final Color barColor;
  final Color statusColor;
  final String statusLabel;
  final bool showAction;
  final bool showDebtorBadge;
  final bool showCheckmark;
  final String actionLabel;
  final bool isSettling;
  final VoidCallback? onMarkPaid;
  final RequestRole role;

  _StatusPanelStyle _panelStyle() {
    if (showCheckmark) {
      return const _StatusPanelStyle(
        background: AppColors.accentSoft,
        border: Color(0x330E9375),
        iconBg: AppColors.surface,
        icon: Icons.verified_rounded,
      );
    }
    if (showDebtorBadge) {
      return const _StatusPanelStyle(
        background: AppColors.accentSoft,
        border: Color(0x330E9375),
        iconBg: AppColors.surface,
        icon: Icons.schedule_rounded,
      );
    }
    if (showAction && role == RequestRole.lender && progress > 0) {
      return const _StatusPanelStyle(
        background: AppColors.pendingBg,
        border: Color(0x33956500),
        iconBg: AppColors.surface,
        icon: Icons.hourglass_top_rounded,
      );
    }
    if (showAction && role == RequestRole.debtor) {
      return const _StatusPanelStyle(
        background: AppColors.errorBg,
        border: AppColors.errorBorder,
        iconBg: AppColors.surface,
        icon: Icons.payments_outlined,
      );
    }
    if (showAction) {
      return const _StatusPanelStyle(
        background: AppColors.errorBg,
        border: AppColors.errorBorder,
        iconBg: AppColors.surface,
        icon: Icons.account_balance_wallet_outlined,
      );
    }
    return const _StatusPanelStyle(
      background: AppColors.surfaceMuted,
      border: AppColors.border,
      iconBg: AppColors.surface,
      icon: Icons.receipt_long_outlined,
    );
  }

  @override
  Widget build(BuildContext context) {
    final style = _panelStyle();

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: style.background,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: style.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: style.iconBg,
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: Icon(
                    style.icon,
                    color: statusColor,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _statusEyebrow(),
                        style: TextStyle(
                          color: statusColor,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.08,
                        ),
                      ),
                      if (!showDebtorBadge) ...[
                        const SizedBox(height: 4),
                        Text(
                          _statusTitle(),
                          style: TextStyle(
                            color: statusColor,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            height: 1.2,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                if (showAction)
                  _MarkPaidButton(
                    label: actionLabel,
                    isLoading: isSettling,
                    onPressed: onMarkPaid,
                  )
                else if (showDebtorBadge)
                  const _DebtorMarkedBadge(),
              ],
            ),
            const SizedBox(height: 12),
            _SettlementProgressBar(
              progress: progress,
              color: barColor,
              showCheckmark: showCheckmark,
            ),
          ],
        ),
      ),
    );
  }

  String _statusEyebrow() {
    if (showCheckmark) return 'SETTLEMENT COMPLETE';
    if (showDebtorBadge) return 'AWAITING CONFIRMATION';
    if (showAction && role == RequestRole.lender && progress > 0) {
      return 'ACTION NEEDED';
    }
    if (showAction) return 'ACTION NEEDED';
    return 'STATUS';
  }

  String _statusTitle() {
    if (statusLabel == 'Not paid') return 'Not paid yet';
    return statusLabel[0].toUpperCase() + statusLabel.substring(1);
  }
}

class _StatusPanelStyle {
  const _StatusPanelStyle({
    required this.background,
    required this.border,
    required this.iconBg,
    required this.icon,
  });

  final Color background;
  final Color border;
  final Color iconBg;
  final IconData icon;
}

class _SettlementProgressBar extends StatelessWidget {
  const _SettlementProgressBar({
    required this.progress,
    required this.color,
    required this.showCheckmark,
  });

  final double progress;
  final Color color;
  final bool showCheckmark;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: SizedBox(
              height: 7,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ColoredBox(
                    color: AppColors.surface.withValues(alpha: 0.72),
                  ),
                  FractionallySizedBox(
                    alignment: Alignment.centerLeft,
                    widthFactor: progress.clamp(0.0, 1.0),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: color,
                        boxShadow: progress > 0
                            ? [
                                BoxShadow(
                                  color: color.withValues(alpha: 0.35),
                                  blurRadius: 6,
                                  offset: const Offset(0, 1),
                                ),
                              ]
                            : null,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        if (showCheckmark) ...[
          const SizedBox(width: 8),
          Container(
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              color: AppColors.surface,
              shape: BoxShape.circle,
              border: Border.all(
                color: AppColors.accent.withValues(alpha: 0.2),
              ),
            ),
            child: const Icon(
              Icons.check_rounded,
              size: 14,
              color: AppColors.accent,
            ),
          ),
        ],
      ],
    );
  }
}

class _MarkPaidButton extends StatelessWidget {
  const _MarkPaidButton({
    required this.label,
    required this.isLoading,
    required this.onPressed,
  });

  final String label;
  final bool isLoading;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: AppColors.accent.withValues(alpha: 0.22),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: FilledButton.icon(
        onPressed: isLoading ? null : onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          minimumSize: Size.zero,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        icon: isLoading
            ? const SizedBox(
                height: 14,
                width: 14,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              )
            : const Icon(Icons.check_rounded, size: 16),
        label: Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.01,
          ),
        ),
      ),
    );
  }
}

class _DebtorMarkedBadge extends StatelessWidget {
  const _DebtorMarkedBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.accent.withValues(alpha: 0.18)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              color: AppColors.accentSoft,
              borderRadius: BorderRadius.circular(999),
            ),
            child: const Icon(
              Icons.check_rounded,
              size: 14,
              color: AppColors.accent,
            ),
          ),
          const SizedBox(width: 8),
          const Text(
            'You marked as paid',
            style: TextStyle(
              color: AppColors.accent,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
