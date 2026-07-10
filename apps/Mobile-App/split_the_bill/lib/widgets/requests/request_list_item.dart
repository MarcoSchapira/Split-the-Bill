import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../../utils/request_items.dart';

class RequestListItem extends StatelessWidget {
  const RequestListItem({super.key, required this.item});

  final RequestItem item;

  @override
  Widget build(BuildContext context) {
    final progress = settlementProgress(item.settlementStatus);
    final progressColor = settlementProgressColor(
      settlementStatus: item.settlementStatus,
      direction: item.direction,
    );
    final amountColor = item.direction == RequestDirection.owedToYou
        ? AppColors.accent
        : AppColors.error;

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
                    child: Text(
                      displayName(item.counterparty),
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textH,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    formatCad(item.amountCents),
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: amountColor,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                '${item.billLabel} · ${formatDateUtc(item.incurredAt)}',
                style: const TextStyle(
                  color: AppColors.text,
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 5,
                  backgroundColor: AppColors.surfaceMuted,
                  color: progressColor,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                settlementStatusLabel(item.settlementStatus),
                style: TextStyle(
                  color: progressColor,
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
