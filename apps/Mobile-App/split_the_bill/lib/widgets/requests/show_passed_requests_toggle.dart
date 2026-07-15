import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';

class ShowPassedRequestsToggle extends StatelessWidget {
  const ShowPassedRequestsToggle({
    super.key,
    required this.isEnabled,
    required this.onPressed,
  });

  final bool isEnabled;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final backgroundColor =
        isEnabled ? AppColors.accentSoft : AppColors.surfaceMuted;
    final borderColor = isEnabled
        ? AppColors.accent.withValues(alpha: 0.28)
        : AppColors.border;
    final textColor =
        isEnabled ? AppColors.accent : AppColors.text.withValues(alpha: 0.82);
    final iconBackground =
        isEnabled ? AppColors.accent : AppColors.brandSoft.withValues(alpha: 0.55);
    final iconColor = isEnabled ? Colors.white : AppColors.text;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(999),
        child: Ink(
          decoration: BoxDecoration(
            color: backgroundColor,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: borderColor),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 7, 8, 7),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Show passed requests',
                  style: TextStyle(
                    color: textColor,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  width: 18,
                  height: 18,
                  decoration: BoxDecoration(
                    color: iconBackground,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isEnabled ? Icons.check_rounded : Icons.close_rounded,
                    size: 12,
                    color: iconColor,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
