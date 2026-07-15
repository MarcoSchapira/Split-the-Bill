import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../../utils/request_items.dart';

class RequestTotalsCard extends StatelessWidget {
  const RequestTotalsCard({
    super.key,
    required this.direction,
    required this.totals,
  });

  final RequestDirection direction;
  final RequestDirectionTotals totals;

  @override
  Widget build(BuildContext context) {
    final isOwedToYou = direction == RequestDirection.owedToYou;
    final amountColor = isOwedToYou ? AppColors.accent : AppColors.error;
    final label = isOwedToYou ? 'You are owed' : 'You owe';
    final pendingLabel = isOwedToYou
        ? 'Awaiting your confirmation'
        : 'Awaiting confirmation';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: amountColor, width: 1.5),
            boxShadow: [
              BoxShadow(
                color: AppColors.textH.withValues(alpha: 0.04),
                blurRadius: 14,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label.toUpperCase(),
                style: TextStyle(
                  color: amountColor,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.6,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                formatCad(totals.totalCents),
                style: TextStyle(
                  color: amountColor,
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  height: 1.1,
                ),
              ),
              if (totals.pendingConfirmationCents > 0) ...[
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppColors.pendingBg,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.hourglass_top_rounded,
                        size: 18,
                        color: AppColors.pendingText,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          pendingLabel,
                          style: const TextStyle(
                            color: AppColors.pendingText,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      Text(
                        formatCad(totals.pendingConfirmationCents),
                        style: const TextStyle(
                          color: AppColors.pendingText,
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 8),
        Divider(
          height: 2,
          thickness: 2,
          color: AppColors.border,
        ),
        const SizedBox(height: 20),
      ],
    );
  }
}
