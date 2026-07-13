import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../../utils/request_items.dart';
import '../../utils/settlement_status.dart';

class RequestListItem extends StatelessWidget {
  const RequestListItem({super.key, required this.item});

  final RequestItem item;

  Color _directionColor(RequestDirection direction) {
    return direction == RequestDirection.owedToYou
        ? AppColors.accent
        : AppColors.error;
  }

  @override
  Widget build(BuildContext context) {
    final counterpartyName = displayName(item.counterparty);
    final progress = settlementProgress(
      payerMarkedAsPaid: item.payerMarkedAsPaid,
      lenderConfirmedPaid: item.lenderConfirmedPaid,
    );
    final directionColor = settlementStatusColor(
      payerMarkedAsPaid: item.payerMarkedAsPaid,
      lenderConfirmedPaid: item.lenderConfirmedPaid,
    );

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: AppColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/bills/${item.billId}'),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.billLabel,
                          style: const TextStyle(
                            fontSize: 19,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textH,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          counterpartyName,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textH,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          formatDateUtc(item.incurredAt),
                          style: const TextStyle(
                            color: AppColors.text,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        requestAmountDirectionLabel(item.direction),
                        style: const TextStyle(
                          color: AppColors.text,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        formatCad(item.amountCents),
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: _directionColor(item.direction),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 5,
                  backgroundColor: AppColors.surfaceMuted,
                  color: directionColor,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                settlementStatusDetailLabel(
                  payerMarkedAsPaid: item.payerMarkedAsPaid,
                  lenderConfirmedPaid: item.lenderConfirmedPaid,
                  counterpartyName: counterpartyName,
                  direction: item.direction,
                ),
                style: TextStyle(
                  color: directionColor,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
