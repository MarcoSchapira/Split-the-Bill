import 'package:flutter/material.dart';
import '../../models/receipt.dart';
import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../common_widgets.dart';

class BillFlowSummaryCard extends StatelessWidget {
  const BillFlowSummaryCard({
    super.key,
    required this.receipt,
    required this.payerName,
    this.incurredAt,
    this.eyebrowText = 'Captured receipt',
  });

  final ParsedReceipt receipt;
  final String payerName;
  final DateTime? incurredAt;
  final String eyebrowText;

  @override
  Widget build(BuildContext context) {
    final totalCents = receipt.total != null
        ? (receipt.total! * 100).round()
        : receipt.items.fold<int>(0, (sum, item) => sum + item.totalPriceCents);

    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: AppColors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Eyebrow(eyebrowText),
            const SizedBox(height: 8),
            Text(
              formatCad(totalCents),
              style: const TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w700,
                color: AppColors.textH,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              '${_dateLabel()} · Paid by $payerName',
              style: const TextStyle(color: AppColors.text),
            ),
          ],
        ),
      ),
    );
  }

  String _dateLabel() {
    if (incurredAt != null) {
      return formatDateUtc(incurredAt!.toUtc().toIso8601String());
    }
    if (receipt.date != null && receipt.date!.trim().isNotEmpty) {
      return receipt.date!;
    }
    return formatDateUtc(DateTime.now().toUtc().toIso8601String());
  }
}
