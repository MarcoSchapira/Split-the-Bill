import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../api/api_exception.dart';
import '../../constants/group_icons.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../common_widgets.dart';

Future<void> showCreateGroupSheet(
  BuildContext context, {
  String? initialName,
  String? initialIconKey,
  String? groupId,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => CreateGroupSheet(
      initialName: initialName,
      initialIconKey: initialIconKey,
      groupId: groupId,
    ),
  );
}

class CreateGroupSheet extends ConsumerStatefulWidget {
  const CreateGroupSheet({
    super.key,
    this.initialName,
    this.initialIconKey,
    this.groupId,
  });

  final String? initialName;
  final String? initialIconKey;
  final String? groupId;

  @override
  ConsumerState<CreateGroupSheet> createState() => _CreateGroupSheetState();
}

class _CreateGroupSheetState extends ConsumerState<CreateGroupSheet> {
  late final TextEditingController _nameController;
  late String _selectedIconKey;
  String? _error;
  bool _isSaving = false;

  bool get _isEditing => widget.groupId != null;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.initialName ?? '');
    _selectedIconKey = widget.initialIconKey ?? defaultGroupIconKey;
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Enter a group name.');
      return;
    }

    setState(() {
      _error = null;
      _isSaving = true;
    });

    try {
      final api = ref.read(groupsApiProvider);
      if (_isEditing) {
        await api.updateGroup(
          widget.groupId!,
          name: name,
          iconKey: _selectedIconKey,
        );
      } else {
        await api.createGroup(name: name, iconKey: _selectedIconKey);
      }
      notifyDataChanged(ref);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_isEditing ? 'Group updated.' : 'Group created.'),
          ),
        );
      }
    } catch (e) {
      setState(() => _error = apiErrorMessage(e, 'Unable to save group.'));
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
          Text(
            _isEditing ? 'Edit group' : 'Create group',
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
          TextField(
            controller: _nameController,
            decoration: const InputDecoration(labelText: 'Group name'),
            textCapitalization: TextCapitalization.words,
          ),
          const SizedBox(height: 20),
          const Text('Icon', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 4,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            children: groupIconKeys.map((iconKey) {
              final selected = iconKey == _selectedIconKey;
              return InkWell(
                onTap: () => setState(() => _selectedIconKey = iconKey),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: selected ? AppColors.accent : AppColors.border,
                      width: selected ? 2 : 1,
                    ),
                    color: selected ? AppColors.accentSoft : AppColors.surface,
                  ),
                  child: Icon(
                    groupIconForKey(iconKey),
                    color: selected ? AppColors.accent : AppColors.text,
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 20),
          PrimaryButton(
            label: _isEditing ? 'Save changes' : 'Create group',
            onPressed: _submit,
            isLoading: _isSaving,
          ),
        ],
      ),
    );
  }
}
