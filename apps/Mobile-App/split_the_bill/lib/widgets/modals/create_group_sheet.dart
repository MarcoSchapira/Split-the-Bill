import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../api/api_exception.dart';
import '../../providers/providers.dart';
import '../common_widgets.dart';

class CreateGroupSheet extends ConsumerStatefulWidget {
  const CreateGroupSheet({super.key});

  @override
  ConsumerState<CreateGroupSheet> createState() => _CreateGroupSheetState();
}

class _CreateGroupSheetState extends ConsumerState<CreateGroupSheet> {
  final _nameController = TextEditingController();
  String? _error;
  bool _isSaving = false;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _isSaving = true;
    });

    try {
      final group = await ref.read(groupsApiProvider).createGroup(_nameController.text.trim());
      notifyDataChanged(ref);
      if (mounted) {
        Navigator.pop(context);
        context.go('/groups/${group.id}');
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Group created.')),
        );
      }
    } catch (e) {
      setState(() => _error = apiErrorMessage(e, 'Unable to create group.'));
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
          const Text('Create group', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          const Text('Start a shared group for bills.'),
          const SizedBox(height: 16),
          if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
          TextField(
            controller: _nameController,
            decoration: const InputDecoration(labelText: 'Group name'),
          ),
          const SizedBox(height: 16),
          PrimaryButton(label: 'Create group', onPressed: _submit, isLoading: _isSaving),
        ],
      ),
    );
  }
}
