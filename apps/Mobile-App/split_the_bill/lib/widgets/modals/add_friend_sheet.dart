import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../api/api_exception.dart';
import '../../providers/providers.dart';
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
        context.go('/invitations');
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Friend invitation sent.')),
        );
      }
    } catch (e) {
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
          const Text('Send an invitation by email.'),
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
