import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';

class BillFlowStepHeader extends StatelessWidget {
  const BillFlowStepHeader({
    super.key,
    required this.stepNumber,
    required this.totalSteps,
    required this.title,
  });

  final int stepNumber;
  final int totalSteps;
  final String title;

  @override
  Widget build(BuildContext context) {
    final clampedSteps = totalSteps < 1 ? 1 : totalSteps;
    final progress = (stepNumber.clamp(1, clampedSteps)) / clampedSteps;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Step $stepNumber of $clampedSteps · $title',
          style: const TextStyle(
            color: AppColors.text,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 6,
            color: AppColors.accent,
            backgroundColor: AppColors.border,
          ),
        ),
      ],
    );
  }
}
