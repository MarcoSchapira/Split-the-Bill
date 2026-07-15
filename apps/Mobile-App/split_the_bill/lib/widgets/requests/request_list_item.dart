import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../../utils/request_items.dart';
import 'request_settlement_status_panel.dart';

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
          RequestSettlementStatusPanel(
            payerMarkedAsPaid: item.payerMarkedAsPaid,
            lenderConfirmedPaid: item.lenderConfirmedPaid,
            role: item.role,
            isSettling: isSettling,
            onMarkPaid: onMarkPaid,
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
