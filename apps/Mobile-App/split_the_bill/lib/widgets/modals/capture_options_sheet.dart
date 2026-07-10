import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
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
  Future<void> _pickImage(ImageSource source) async {
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
