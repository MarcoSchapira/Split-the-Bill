import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';
import '../../utils/request_items.dart';
import '../../utils/settlement_status.dart';

class RequestSettlementStatusPanel extends StatelessWidget {
  const RequestSettlementStatusPanel({
    super.key,
    required this.payerMarkedAsPaid,
    required this.lenderConfirmedPaid,
    required this.role,
    this.isSettling = false,
    this.onMarkPaid,
    this.embedInCard = true,
  });

  final bool payerMarkedAsPaid;
  final bool lenderConfirmedPaid;
  final RequestRole role;
  final bool isSettling;
  final VoidCallback? onMarkPaid;

  /// When true (default), adds outer padding used inside request list cards.
  /// Set false when embedding under bill participant rows.
  final bool embedInCard;

  @override
  Widget build(BuildContext context) {
    final progress = requestSettlementProgress(
      payerMarkedAsPaid: payerMarkedAsPaid,
      lenderConfirmedPaid: lenderConfirmedPaid,
    );
    final barColor = requestSettlementBarColor(
      payerMarkedAsPaid: payerMarkedAsPaid,
      lenderConfirmedPaid: lenderConfirmedPaid,
      role: role,
    );
    final statusColor = requestSettlementStatusColor(
      payerMarkedAsPaid: payerMarkedAsPaid,
      lenderConfirmedPaid: lenderConfirmedPaid,
      role: role,
    );
    final showAction = canShowRequestMarkPaidAction(
      payerMarkedAsPaid: payerMarkedAsPaid,
      lenderConfirmedPaid: lenderConfirmedPaid,
      role: role,
    );
    final showDebtorBadge = showDebtorMarkedBadge(
      payerMarkedAsPaid: payerMarkedAsPaid,
      lenderConfirmedPaid: lenderConfirmedPaid,
      role: role,
    );
    final statusLabel = requestSettlementStatusLabel(
      payerMarkedAsPaid: payerMarkedAsPaid,
      lenderConfirmedPaid: lenderConfirmedPaid,
      role: role,
    );
    final showCheckmark = lenderConfirmedPaid;
    final actionLabel = requestMarkPaidActionLabel(role);
    final style = _panelStyle(
      showCheckmark: showCheckmark,
      showDebtorBadge: showDebtorBadge,
      showAction: showAction,
      role: role,
      progress: progress,
    );

    final panel = Container(
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
                      _statusEyebrow(
                        showCheckmark: showCheckmark,
                        showDebtorBadge: showDebtorBadge,
                        showAction: showAction,
                      ),
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
                        _statusTitle(statusLabel),
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
    );

    if (!embedInCard) return panel;

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      child: panel,
    );
  }

  static _StatusPanelStyle _panelStyle({
    required bool showCheckmark,
    required bool showDebtorBadge,
    required bool showAction,
    required RequestRole role,
    required double progress,
  }) {
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
        background: AppColors.pendingBg,
        border: Color(0x33956500),
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

  static String _statusEyebrow({
    required bool showCheckmark,
    required bool showDebtorBadge,
    required bool showAction,
  }) {
    if (showCheckmark) return 'SETTLEMENT COMPLETE';
    if (showDebtorBadge) return 'AWAITING CONFIRMATION';
    if (showAction) return 'ACTION NEEDED';
    return 'STATUS';
  }

  static String _statusTitle(String statusLabel) {
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
        border: Border.all(color: AppColors.pendingText.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              color: AppColors.pendingBg,
              borderRadius: BorderRadius.circular(999),
            ),
            child: const Icon(
              Icons.check_rounded,
              size: 14,
              color: AppColors.pendingText,
            ),
          ),
          const SizedBox(width: 8),
          const Text(
            'You marked as paid',
            style: TextStyle(
              color: AppColors.pendingText,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
