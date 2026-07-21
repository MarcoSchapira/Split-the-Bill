import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../api/api_exception.dart';
import '../../providers/providers.dart';
import '../../screens/settings/legal_document_screen.dart';
import '../../theme/app_colors.dart';
import '../../widgets/common_widgets.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  static const _resendCooldownSeconds = 60;

  bool _detailsStep = false;
  bool _agreedToTerms = false;
  bool _showTermsRequiredError = false;
  final _emailController = TextEditingController();
  final _nameController = TextEditingController();
  final _codeController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  late final TapGestureRecognizer _termsTap;
  late final TapGestureRecognizer _privacyTap;
  String? _error;
  String? _info;
  bool _isSendingCode = false;
  bool _isSubmitting = false;
  int _resendCooldown = 0;
  Timer? _cooldownTimer;

  @override
  void initState() {
    super.initState();
    _termsTap = TapGestureRecognizer()
      ..onTap = () {
        Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => const TermsOfServiceScreen(),
          ),
        );
      };
    _privacyTap = TapGestureRecognizer()
      ..onTap = () {
        Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => const PrivacyPolicyScreen(),
          ),
        );
      };
  }

  @override
  void dispose() {
    _emailController.dispose();
    _nameController.dispose();
    _codeController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _termsTap.dispose();
    _privacyTap.dispose();
    _cooldownTimer?.cancel();
    super.dispose();
  }

  void _startCooldown() {
    _cooldownTimer?.cancel();
    setState(() => _resendCooldown = _resendCooldownSeconds);
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_resendCooldown <= 1) {
        timer.cancel();
        setState(() => _resendCooldown = 0);
      } else {
        setState(() => _resendCooldown -= 1);
      }
    });
  }

  bool _ensureAgreedToTerms() {
    if (_agreedToTerms) return true;
    setState(() => _showTermsRequiredError = true);
    return false;
  }

  Future<void> _sendCode() async {
    if (!_ensureAgreedToTerms()) return;

    setState(() {
      _error = null;
      _info = null;
      _isSendingCode = true;
    });

    try {
      await ref.read(authApiProvider).sendRegistrationCode(_emailController.text.trim());
      setState(() {
        _detailsStep = true;
        _info = 'Verification code sent to ${_emailController.text.trim().toLowerCase()}.';
      });
      _startCooldown();
    } catch (e) {
      setState(() => _error = apiErrorMessage(e, 'Unable to send verification code.'));
    } finally {
      if (mounted) setState(() => _isSendingCode = false);
    }
  }

  Future<void> _submit() async {
    if (!_ensureAgreedToTerms()) return;

    setState(() => _error = null);

    final code = _codeController.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(code)) {
      setState(() => _error = 'Enter the 6-digit verification code.');
      return;
    }

    if (_passwordController.text.length < 8) {
      setState(() => _error = 'Password must be at least 8 characters.');
      return;
    }

    if (_passwordController.text != _confirmPasswordController.text) {
      setState(() => _error = 'Passwords do not match.');
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      await ref.read(authProvider.notifier).register(
            email: _emailController.text.trim(),
            password: _passwordController.text,
            code: code,
            name: _nameController.text.trim().isEmpty ? null : _nameController.text.trim(),
          );
      if (mounted) context.go('/dashboard');
    } catch (e) {
      setState(() => _error = apiErrorMessage(e, 'Unable to register.'));
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Widget _buildTermsAgreement() {
    final borderColor =
        _showTermsRequiredError ? AppColors.error : AppColors.border;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(12, 12, 14, 12),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: borderColor, width: 1.5),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 24,
                height: 24,
                child: Checkbox(
                  value: _agreedToTerms,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  visualDensity: VisualDensity.compact,
                  side: BorderSide(
                    color: _showTermsRequiredError
                        ? AppColors.error
                        : AppColors.border,
                    width: 1.5,
                  ),
                  onChanged: (value) {
                    setState(() {
                      _agreedToTerms = value ?? false;
                      if (_agreedToTerms) _showTermsRequiredError = false;
                    });
                  },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text.rich(
                  TextSpan(
                    style: const TextStyle(
                      fontSize: 14,
                      height: 1.4,
                      color: AppColors.text,
                    ),
                    children: [
                      const TextSpan(
                        text: 'By creating an account you agree to the ',
                      ),
                      TextSpan(
                        text: 'Terms of Service',
                        style: const TextStyle(
                          color: AppColors.accent,
                          fontWeight: FontWeight.w600,
                          decoration: TextDecoration.underline,
                          decorationColor: AppColors.accent,
                        ),
                        recognizer: _termsTap,
                      ),
                      const TextSpan(text: ' and '),
                      TextSpan(
                        text: 'Privacy Policy',
                        style: const TextStyle(
                          color: AppColors.accent,
                          fontWeight: FontWeight.w600,
                          decoration: TextDecoration.underline,
                          decorationColor: AppColors.accent,
                        ),
                        recognizer: _privacyTap,
                      ),
                      const TextSpan(text: ' and confirm you are 18 years of age or older.'),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        if (_showTermsRequiredError) ...[
          const SizedBox(height: 8),
          const Text(
            'Required',
            style: TextStyle(
              color: AppColors.error,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(28),
                decoration: const BoxDecoration(
                  gradient: AppColors.brandGradient,
                  borderRadius: BorderRadius.all(Radius.circular(20)),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Eyebrow('BillCompass'),
                    SizedBox(height: 8),
                    Text(
                      'Create account',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
              if (_info != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(_info!, style: const TextStyle(color: AppColors.accent)),
                ),
              if (!_detailsStep) ...[
                TextField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: 'Email'),
                ),
                const SizedBox(height: 16),
                _buildTermsAgreement(),
                const SizedBox(height: 20),
                PrimaryButton(
                  label: 'Send verification code',
                  onPressed: _sendCode,
                  isLoading: _isSendingCode,
                ),
              ] else ...[
                TextField(
                  controller: _emailController,
                  readOnly: true,
                  decoration: const InputDecoration(labelText: 'Email'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _codeController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: '6-digit code'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _nameController,
                  decoration: const InputDecoration(labelText: 'Name (optional)'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _passwordController,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Password'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _confirmPasswordController,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Confirm password'),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: _resendCooldown > 0 ? null : _sendCode,
                  child: Text(
                    _resendCooldown > 0
                        ? 'Resend code in ${_resendCooldown}s'
                        : 'Resend verification code',
                  ),
                ),
                const SizedBox(height: 12),
                PrimaryButton(
                  label: 'Create account',
                  onPressed: _submit,
                  isLoading: _isSubmitting,
                ),
              ],
              const SizedBox(height: 16),
              Center(
                child: TextButton(
                  onPressed: () => context.go('/login'),
                  child: const Text('Already have an account? Sign in'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
