import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../api/api_exception.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../common_widgets.dart';

class AddFriendSheet extends ConsumerStatefulWidget {
  const AddFriendSheet({super.key});

  @override
  ConsumerState<AddFriendSheet> createState() => _AddFriendSheetState();
}

class _AddFriendSheetState extends ConsumerState<AddFriendSheet> {
  final _emailController = TextEditingController();
  String? _error;
  bool _isSaving = false;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _showUserNotFoundDialog() async {
    await showDialog<void>(
      context: context,
      barrierColor: AppColors.modalBackdrop,
      builder: (context) => const _AccountNotFoundDialog(),
    );
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _isSaving = true;
    });

    try {
      await ref.read(friendsApiProvider).inviteFriend(_emailController.text.trim());
      notifyDataChanged(ref);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Friend invitation sent.')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      if (e is ApiException && e.code == 'USER_NOT_FOUND') {
        setState(() => _isSaving = false);
        await _showUserNotFoundDialog();
        return;
      }
      setState(() => _error = apiErrorMessage(e, 'Unable to send invitation.'));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Add friend', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          const Text('Invite someone who already has an EquiShare account.'),
          const SizedBox(height: 16),
          if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
          TextField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Email'),
          ),
          const SizedBox(height: 16),
          PrimaryButton(label: 'Send invitation', onPressed: _submit, isLoading: _isSaving),
        ],
      ),
    );
  }
}

class _AccountNotFoundDialog extends StatelessWidget {
  const _AccountNotFoundDialog();

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      backgroundColor: AppColors.surface,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(22, 28, 22, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: AppColors.pendingBg,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: AppColors.pendingText.withValues(alpha: 0.2),
                  ),
                ),
                child: const Icon(
                  Icons.person_search_outlined,
                  color: AppColors.pendingText,
                  size: 30,
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Account not found',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.textH,
                fontSize: 20,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'No EquiShare account exists for this email. '
              'Ask them to sign up first, then try inviting them again.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.text.withValues(alpha: 0.9),
                fontSize: 14,
                height: 1.45,
              ),
            ),
            const SizedBox(height: 24),
            PrimaryButton(
              label: 'Got it',
              onPressed: () => Navigator.of(context).pop(),
            ),
          ],
        ),
      ),
    );
  }
}
