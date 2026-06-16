import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../utils/format.dart';

class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.compact = false,
    this.isLoading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool compact;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton(
        onPressed: isLoading ? null : onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: Colors.white,
          padding: EdgeInsets.symmetric(
            vertical: compact ? 11 : 15,
            horizontal: compact ? 19 : 25,
          ),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13)),
        ),
        child: isLoading
            ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
              )
            : Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
      ),
    );
  }
}

class SecondaryButton extends StatelessWidget {
  const SecondaryButton({
    super.key,
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.textH,
          backgroundColor: AppColors.surface,
          side: const BorderSide(color: AppColors.border),
          padding: const EdgeInsets.symmetric(vertical: 15, horizontal: 25),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13)),
        ),
        child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
      ),
    );
  }
}

class ErrorBanner extends StatelessWidget {
  const ErrorBanner({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.errorBg,
        border: Border.all(color: AppColors.errorBorder),
        borderRadius: BorderRadius.circular(13),
      ),
      child: Text(message, style: const TextStyle(color: AppColors.error)),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: const TextStyle(color: AppColors.text),
      ),
    );
  }
}

class LoadingView extends StatelessWidget {
  const LoadingView({super.key, this.message = 'Loading...'});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(color: AppColors.accent),
          const SizedBox(height: 16),
          Text(message, style: const TextStyle(color: AppColors.text)),
        ],
      ),
    );
  }
}

class Eyebrow extends StatelessWidget {
  const Eyebrow(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: const TextStyle(
        color: AppColors.accent,
        fontSize: 12,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.08,
      ),
    );
  }
}

class AppBrandTitle extends StatelessWidget {
  const AppBrandTitle({super.key});

  @override
  Widget build(BuildContext context) {
    return const Text(
      'EquiSplit',
      style: TextStyle(
        color: AppColors.accent,
        fontSize: 24,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.04,
      ),
    );
  }
}

class SummaryCard extends StatelessWidget {
  const SummaryCard({
    super.key,
    required this.label,
    required this.amount,
    this.positive = false,
    this.negative = false,
  });

  final String label;
  final String amount;
  final bool positive;
  final bool negative;

  @override
  Widget build(BuildContext context) {
    Color amountColor = AppColors.textH;
    if (positive) amountColor = AppColors.accent;
    if (negative) amountColor = AppColors.error;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(color: AppColors.text, fontSize: 14)),
            const SizedBox(height: 8),
            Text(
              amount,
              style: TextStyle(
                color: amountColor,
                fontSize: 22,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class CountBadge extends StatelessWidget {
  const CountBadge({super.key, required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.accentSoft,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        '$count',
        style: const TextStyle(
          color: AppColors.accent,
          fontWeight: FontWeight.w700,
          fontSize: 13,
        ),
      ),
    );
  }
}

class BalanceChip extends StatelessWidget {
  const BalanceChip({super.key, required this.cents});

  final int cents;

  @override
  Widget build(BuildContext context) {
    final positive = cents > 0;
    final negative = cents < 0;
    return Text(
      formatCad(cents.abs()),
      style: TextStyle(
        color: positive
            ? AppColors.accent
            : negative
                ? AppColors.error
                : AppColors.text,
        fontWeight: FontWeight.w700,
      ),
    );
  }
}

Future<bool?> showConfirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'Delete',
}) {
  return showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
        TextButton(
          onPressed: () => Navigator.pop(context, true),
          style: TextButton.styleFrom(foregroundColor: AppColors.error),
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
}
