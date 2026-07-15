import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../api/api_exception.dart';
import '../../models/user.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../widgets/common_widgets.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  static const _appVersion = '1.0.0';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: user == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
              children: [
                _SectionLabel('Account'),
                Card(
                  child: Column(
                    children: [
                      ListTile(
                        leading: CircleAvatar(
                          backgroundColor: AppColors.accentSoft,
                          foregroundColor: AppColors.accent,
                          child: Text(
                            _initials(user),
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                        title: Text(
                          user.name?.isNotEmpty == true ? user.name! : 'Add a name',
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            color: AppColors.textH,
                          ),
                        ),
                        subtitle: Text(user.email),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => _editName(context, ref, user),
                      ),
                      const Divider(height: 1),
                      ListTile(
                        leading: const Icon(Icons.email_outlined),
                        title: const Text('Email'),
                        subtitle: Text(user.email),
                        enabled: false,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                _SectionLabel('Security'),
                Card(
                  child: Column(
                    children: [
                      ListTile(
                        leading: const Icon(Icons.lock_outline),
                        title: const Text('Change password'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => _changePassword(context, ref),
                      ),
                      const Divider(height: 1),
                      ListTile(
                        leading: const Icon(Icons.logout),
                        title: const Text('Log out'),
                        onTap: () => _logout(context, ref),
                      ),
                      const Divider(height: 1),
                      ListTile(
                        leading: const Icon(Icons.devices_other_outlined),
                        title: const Text('Log out of all devices'),
                        textColor: AppColors.error,
                        iconColor: AppColors.error,
                        onTap: () => _logoutAll(context, ref),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                _SectionLabel('About'),
                Card(
                  child: Column(
                    children: [
                      const ListTile(
                        leading: Icon(Icons.info_outline),
                        title: Text('Version'),
                        trailing: Text(
                          _appVersion,
                          style: TextStyle(color: AppColors.text),
                        ),
                      ),
                      const Divider(height: 1),
                      ListTile(
                        leading: const Icon(Icons.privacy_tip_outlined),
                        title: const Text('Privacy Policy'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => context.push('/settings/privacy'),
                      ),
                      const Divider(height: 1),
                      ListTile(
                        leading: const Icon(Icons.description_outlined),
                        title: const Text('Terms of Service'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => context.push('/settings/terms'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  static String _initials(User user) {
    final name = user.name?.trim();
    if (name != null && name.isNotEmpty) {
      final parts = name.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
      if (parts.length >= 2) {
        return '${parts.first[0]}${parts[1][0]}'.toUpperCase();
      }
      return parts.first[0].toUpperCase();
    }
    if (user.email.isNotEmpty) {
      return user.email[0].toUpperCase();
    }
    return '?';
  }

  Future<void> _editName(BuildContext context, WidgetRef ref, User user) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _EditNameDialog(initialName: user.name ?? ''),
    );

    if (saved == true && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Name updated')),
      );
    }
  }

  Future<void> _changePassword(BuildContext context, WidgetRef ref) async {
    final changed = await showDialog<bool>(
      context: context,
      builder: (_) => const _ChangePasswordDialog(),
    );

    if (changed == true && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password updated')),
      );
    }
  }

  Future<void> _logout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Log out?',
      message: 'You will need to sign in again to use EquiSplit on this device.',
      confirmLabel: 'Log out',
    );
    if (confirmed != true || !context.mounted) return;

    await ref.read(authProvider.notifier).logout();
    if (context.mounted) context.go('/login');
  }

  Future<void> _logoutAll(BuildContext context, WidgetRef ref) async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Log out of all devices?',
      message:
          'This ends every active session, including this one. '
          'You will need to sign in again everywhere.',
      confirmLabel: 'Log out everywhere',
    );
    if (confirmed != true || !context.mounted) return;

    await ref.read(authProvider.notifier).logoutAll();
    if (context.mounted) context.go('/login');
  }
}

class _EditNameDialog extends ConsumerStatefulWidget {
  const _EditNameDialog({required this.initialName});

  final String initialName;

  @override
  ConsumerState<_EditNameDialog> createState() => _EditNameDialogState();
}

class _EditNameDialogState extends ConsumerState<_EditNameDialog> {
  late final TextEditingController _controller;
  String? _error;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialName);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _controller.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Name is required.');
      return;
    }

    setState(() {
      _error = null;
      _isSaving = true;
    });

    try {
      await ref.read(authProvider.notifier).updateName(name);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isSaving = false;
        _error = apiErrorMessage(e, 'Unable to update name.');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Edit name'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _controller,
            autofocus: true,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(
              labelText: 'Display name',
            ),
            enabled: !_isSaving,
            onSubmitted: (_) {
              if (!_isSaving) _save();
            },
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            ErrorBanner(message: _error!),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: _isSaving ? null : () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: _isSaving ? null : _save,
          child: _isSaving
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Save'),
        ),
      ],
    );
  }
}

class _ChangePasswordDialog extends ConsumerStatefulWidget {
  const _ChangePasswordDialog();

  @override
  ConsumerState<_ChangePasswordDialog> createState() => _ChangePasswordDialogState();
}

class _ChangePasswordDialogState extends ConsumerState<_ChangePasswordDialog> {
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  String? _error;
  bool _isSaving = false;
  bool _obscure = true;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final current = _currentController.text;
    final next = _newController.text;
    final confirm = _confirmController.text;

    if (current.isEmpty || next.isEmpty || confirm.isEmpty) {
      setState(() => _error = 'All fields are required.');
      return;
    }
    if (next.length < 8) {
      setState(() => _error = 'New password must be at least 8 characters.');
      return;
    }
    if (next != confirm) {
      setState(() => _error = 'New passwords do not match.');
      return;
    }

    setState(() {
      _error = null;
      _isSaving = true;
    });

    try {
      await ref.read(authProvider.notifier).changePassword(
            currentPassword: current,
            newPassword: next,
          );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isSaving = false;
        _error = apiErrorMessage(e, 'Unable to change password.');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Change password'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _currentController,
              obscureText: _obscure,
              decoration: const InputDecoration(
                labelText: 'Current password',
              ),
              enabled: !_isSaving,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _newController,
              obscureText: _obscure,
              decoration: const InputDecoration(
                labelText: 'New password',
                helperText: 'At least 8 characters',
              ),
              enabled: !_isSaving,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _confirmController,
              obscureText: _obscure,
              decoration: const InputDecoration(
                labelText: 'Confirm new password',
              ),
              enabled: !_isSaving,
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: _isSaving ? null : () => setState(() => _obscure = !_obscure),
                icon: Icon(
                  _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                ),
                label: Text(_obscure ? 'Show passwords' : 'Hide passwords'),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              ErrorBanner(message: _error!),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isSaving ? null : () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: _isSaving ? null : _save,
          child: _isSaving
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Update'),
        ),
      ],
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        label.toUpperCase(),
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.6,
          color: AppColors.text,
        ),
      ),
    );
  }
}
