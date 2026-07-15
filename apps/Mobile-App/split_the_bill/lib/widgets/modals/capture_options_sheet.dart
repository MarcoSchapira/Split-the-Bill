import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';

Future<void> showCaptureOptionsSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => const CaptureOptionsSheet(),
  );
}

class CaptureOptionsSheet extends ConsumerStatefulWidget {
  const CaptureOptionsSheet({super.key});

  @override
  ConsumerState<CaptureOptionsSheet> createState() => _CaptureOptionsSheetState();
}

class _CaptureOptionsSheetState extends ConsumerState<CaptureOptionsSheet> {
  Future<bool> _ensureCameraPermission() async {
    final status = await Permission.camera.status;

    if (status.isGranted) return true;

    // Prior hard denial — OS will not show the system prompt again.
    if (status.isPermanentlyDenied || status.isRestricted) {
      if (!mounted) return false;
      await _showCameraPermissionDialog();
      return false;
    }

    // Android: user already denied once — show Settings instructions on retry.
    if (status.isDenied && await Permission.camera.shouldShowRequestRationale) {
      if (!mounted) return false;
      await _showCameraPermissionDialog();
      return false;
    }

    // First attempt: show the system permission dialog.
    final result = await Permission.camera.request();
    if (result.isGranted) return true;

    // Just denied — stay on the sheet; show Settings instructions on next try.
    return false;
  }

  Future<void> _showCameraPermissionDialog() {
    return showDialog<void>(
      context: context,
      barrierColor: AppColors.modalBackdrop,
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
                    Icons.photo_camera_outlined,
                    color: AppColors.accent,
                    size: 28,
                  ),
                ),
                const SizedBox(height: 18),
                const Text(
                  'Camera access needed',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppColors.textH,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'EquiSplit needs camera access to capture receipt photos. Enable it in Settings:',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.text, height: 1.45, fontSize: 15),
                ),
                const SizedBox(height: 20),
                const _PermissionStep(number: '1', label: 'Open Settings'),
                const SizedBox(height: 10),
                const _PermissionStep(number: '2', label: 'Find EquiSplit'),
                const SizedBox(height: 10),
                const _PermissionStep(number: '3', label: 'Turn on Camera'),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(dialogContext),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.textH,
                          side: const BorderSide(color: AppColors.border, width: 1.5),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: const Text(
                          'Got it',
                          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton(
                        onPressed: () {
                          Navigator.pop(dialogContext);
                          openAppSettings();
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.accent,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: const Text(
                          'Open Settings',
                          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _pickImage(ImageSource source) async {
    if (source == ImageSource.camera) {
      final allowed = await _ensureCameraPermission();
      if (!allowed || !mounted) return;
    }

    final router = GoRouter.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final user = ref.read(authProvider).user;
    Navigator.pop(context);

    try {
      final picker = ImagePicker();
      final image = await picker.pickImage(
        source: source,
        imageQuality: 85,
      );

      if (image == null) return;

      final bytes = await image.readAsBytes();
      if (user == null) return;

      router.push('/dashboard/capture/manual', extra: bytes);
    } catch (_) {
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            source == ImageSource.camera
                ? 'Unable to open camera.'
                : 'Unable to open photo library.',
          ),
        ),
      );
    }
  }

  void _openManual() {
    final router = GoRouter.of(context);
    Navigator.pop(context);
    router.push('/dashboard/capture/manual');
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 8,
        bottom: MediaQuery.paddingOf(context).bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.accentSoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.camera_alt_outlined, color: AppColors.accent, size: 22),
              ),
              const SizedBox(width: 12),
              const Text('Capture', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Take a photo, choose from your library, or add a receipt manually.',
            style: TextStyle(color: AppColors.text, height: 1.4),
          ),
          const SizedBox(height: 20),
          _PrimaryCaptureOption(
            icon: Icons.photo_camera_outlined,
            label: 'Take photo',
            onPressed: () => _pickImage(ImageSource.camera),
          ),
          const SizedBox(height: 12),
          _OutlinedCaptureOption(
            icon: Icons.photo_library_outlined,
            label: 'Choose from library',
            onPressed: () => _pickImage(ImageSource.gallery),
          ),
          const SizedBox(height: 12),
          _OutlinedCaptureOption(
            icon: Icons.edit_note_outlined,
            label: 'Manual add receipt',
            onPressed: _openManual,
          ),
        ],
      ),
    );
  }
}

class _PermissionStep extends StatelessWidget {
  const _PermissionStep({required this.number, required this.label});

  final String number;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.accentSoft,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              number,
              style: const TextStyle(
                color: AppColors.accent,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Text(
            label,
            style: const TextStyle(
              color: AppColors.textH,
              fontWeight: FontWeight.w600,
              fontSize: 15,
            ),
          ),
        ],
      ),
    );
  }
}

class _PrimaryCaptureOption extends StatelessWidget {
  const _PrimaryCaptureOption({
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton(
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 22),
            const SizedBox(width: 10),
            Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
          ],
        ),
      ),
    );
  }
}

class _OutlinedCaptureOption extends StatelessWidget {
  const _OutlinedCaptureOption({
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final IconData icon;
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
          side: const BorderSide(color: AppColors.textH, width: 2.5),
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 22),
            const SizedBox(width: 10),
            Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
          ],
        ),
      ),
    );
  }
}
