import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';

class LegalPlaceholderScreen extends StatelessWidget {
  const LegalPlaceholderScreen({
    super.key,
    required this.title,
    required this.body,
  });

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: AppColors.textH,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            body,
            style: const TextStyle(
              fontSize: 15,
              height: 1.5,
              color: AppColors.text,
            ),
          ),
        ],
      ),
    );
  }
}

class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const LegalPlaceholderScreen(
      title: 'Privacy Policy',
      body:
          'This is a placeholder privacy policy for EquiSplit. '
          'A full policy describing how account data, bill history, and '
          'authentication information are handled will be published here before launch.',
    );
  }
}

class TermsOfServiceScreen extends StatelessWidget {
  const TermsOfServiceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const LegalPlaceholderScreen(
      title: 'Terms of Service',
      body:
          'This is a placeholder terms of service for EquiSplit. '
          'The complete terms governing use of the app will be published here before launch.',
    );
  }
}
