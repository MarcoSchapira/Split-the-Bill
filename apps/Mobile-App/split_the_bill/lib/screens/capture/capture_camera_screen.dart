import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../../models/receipt.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../widgets/common_widgets.dart';

class CaptureCameraScreen extends ConsumerStatefulWidget {
  const CaptureCameraScreen({super.key});

  @override
  ConsumerState<CaptureCameraScreen> createState() => _CaptureCameraScreenState();
}

class _CaptureCameraScreenState extends ConsumerState<CaptureCameraScreen> {
  Uint8List? _imageBytes;
  bool _loading = false;
  String? _error;

  Future<void> _pickImage(ImageSource source) async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final picker = ImagePicker();
      final image = await picker.pickImage(
        source: source,
        imageQuality: 85,
      );

      if (!mounted) return;

      if (image == null) {
        setState(() => _loading = false);
        return;
      }

      final bytes = await image.readAsBytes();
      setState(() {
        _imageBytes = bytes;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = source == ImageSource.camera
            ? 'Unable to open camera.'
            : 'Unable to open photo library.';
        _loading = false;
      });
    }
  }

  void _submit() {
    final user = ref.read(authProvider).user;
    final bytes = _imageBytes;
    if (user == null || bytes == null) return;

    final flow = CaptureFlowState(
      imageBytes: bytes,
      currentUser: user,
      payerId: user.id,
    );

    context.push('/dashboard/capture/participants', extra: flow);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Capture receipt')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null) ...[
              ErrorBanner(message: _error!),
              const SizedBox(height: 16),
            ],
            Expanded(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border),
                ),
                child: _loading
                    ? LoadingView(
                        message: _imageBytes == null
                            ? 'Loading image...'
                            : 'Updating image...',
                      )
                    : _imageBytes == null
                        ? const EmptyState(
                            message:
                                'Take a new photo or choose an existing receipt image from your library.',
                          )
                        : ClipRRect(
                            borderRadius: BorderRadius.circular(16),
                            child: Image.memory(
                              _imageBytes!,
                              fit: BoxFit.contain,
                              width: double.infinity,
                            ),
                          ),
              ),
            ),
            const SizedBox(height: 16),
            SecondaryButton(
              label: 'Take photo',
              onPressed: _loading ? null : () => _pickImage(ImageSource.camera),
            ),
            const SizedBox(height: 12),
            SecondaryButton(
              label: 'Choose from library',
              onPressed: _loading ? null : () => _pickImage(ImageSource.gallery),
            ),
            const SizedBox(height: 12),
            PrimaryButton(
              label: 'Submit',
              onPressed: _imageBytes == null || _loading ? null : _submit,
            ),
          ],
        ),
      ),
    );
  }
}
