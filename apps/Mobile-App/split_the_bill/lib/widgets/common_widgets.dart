import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
    final handlePress = onPressed;
    return SizedBox(
      width: double.infinity,
      child: FilledButton(
        onPressed: isLoading || handlePress == null
            ? null
            : () {
                HapticFeedback.lightImpact();
                handlePress();
              },
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: Colors.white,
          padding: EdgeInsets.symmetric(
            vertical: compact ? 11 : 15,
            horizontal: compact ? 19 : 25,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(13),
          ),
        ),
        child: isLoading
            ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
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
    final handlePress = onPressed;
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton(
        onPressed: handlePress == null
            ? null
            : () {
                HapticFeedback.lightImpact();
                handlePress();
              },
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.textH,
          backgroundColor: AppColors.surface,
          side: const BorderSide(color: AppColors.border),
          padding: const EdgeInsets.symmetric(vertical: 15, horizontal: 25),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(13),
          ),
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

/// Full-screen branded loading view shown while restoring the user's session.
class SessionLoadingView extends StatelessWidget {
  const SessionLoadingView({super.key});

  static const _background = Color(0xFF0B745D);
  static const _logoSize = 128.0;
  static const _borderRadius = 28.0;
  static const _borderWidth = 4.0;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: _background,
      alignment: Alignment.center,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(_borderRadius),
              border: Border.all(color: Colors.white, width: _borderWidth),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x33000000),
                  blurRadius: 24,
                  offset: Offset(0, 12),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(_borderRadius - _borderWidth),
              child: Image.asset(
                'assets/equishare_logo_mobile.png',
                width: _logoSize,
                height: _logoSize,
                fit: BoxFit.cover,
              ),
            ),
          ),
          const SizedBox(height: 28),
          const Text(
            'Loading',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.2,
            ),
          ),
          const SizedBox(height: 20),
          const SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(
              color: Colors.white,
              strokeWidth: 2.5,
            ),
          ),
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
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Image.asset(
          'assets/equishare_logo_inverted.png',
          width: 28,
          height: 28,
          fit: BoxFit.contain,
        ),
        const SizedBox(width: 8),
        const Text(
          'BillCompass',
          style: TextStyle(
            color: AppColors.accent,
            fontSize: 24,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.04,
          ),
        ),
      ],
    );
  }
}

/// Shared page title style for the four main tab screens.
const kTabPageTitleStyle = TextStyle(
  fontSize: 24,
  fontWeight: FontWeight.w700,
);

class SummaryCard extends StatelessWidget {
  const SummaryCard({
    super.key,
    required this.label,
    required this.amount,
    this.pendingConfirmationPercent,
    this.positive = false,
    this.negative = false,
    this.onTap,
  });

  final String label;
  final String amount;
  final int? pendingConfirmationPercent;
  final bool positive;
  final bool negative;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    Color amountColor = AppColors.textH;
    if (positive) amountColor = AppColors.accent;
    if (negative) amountColor = AppColors.error;

    final handleTap = onTap;
    return Card(
      child: InkWell(
        onTap: handleTap == null
            ? null
            : () {
                HapticFeedback.selectionClick();
                handleTap();
              },
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(color: AppColors.text, fontSize: 14),
              ),
              const SizedBox(height: 8),
              Text(
                amount,
                style: TextStyle(
                  color: amountColor,
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (pendingConfirmationPercent != null) ...[
                const SizedBox(height: 16),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Text(
                      '$pendingConfirmationPercent%',
                      style: TextStyle(
                        color: amountColor,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        height: 1,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'awaiting',
                          style: TextStyle(
                            color: amountColor.withValues(alpha: 0.72),
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            height: 1.2,
                            letterSpacing: 0.01,
                          ),
                        ),
                        Text(
                          'confirmation',
                          style: TextStyle(
                            color: amountColor.withValues(alpha: 0.72),
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            height: 1.2,
                            letterSpacing: 0.01,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ],
          ),
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
        fontSize: 18,
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
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: () => Navigator.pop(context, true),
          style: TextButton.styleFrom(foregroundColor: AppColors.error),
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
}
