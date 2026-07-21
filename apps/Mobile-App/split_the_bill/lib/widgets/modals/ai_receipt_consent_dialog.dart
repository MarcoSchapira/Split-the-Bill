import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';

/// Confirms sending a receipt image to Google Gemini for AI parsing.
/// Returns `true` if the user continues, `false`/`null` if cancelled.
Future<bool?> showAiReceiptConsentDialog(BuildContext context) {
  return showDialog<bool>(
    context: context,
    barrierDismissible: false,
    barrierColor: AppColors.modalBackdrop,
    useRootNavigator: true,
    builder: (dialogContext) {
      return Dialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        insetPadding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: AppColors.accentSoft,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(
                  Icons.auto_awesome_outlined,
                  color: AppColors.accent,
                  size: 28,
                ),
              ),
              const SizedBox(height: 18),
              const Text(
                'AI receipt processing',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.textH,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 10),
              const Text(
                'BillCompass sends your receipt image to Google Gemini to extract '
                'receipt information. Information visible on the receipt will be '
                'processed by Google.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.text,
                  height: 1.45,
                  fontSize: 15,
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () =>
                      Navigator.of(dialogContext, rootNavigator: true).pop(true),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.accent,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'Continue and Send',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: () =>
                      Navigator.of(dialogContext, rootNavigator: true).pop(false),
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.text,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: const Text(
                    'Cancel',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}
