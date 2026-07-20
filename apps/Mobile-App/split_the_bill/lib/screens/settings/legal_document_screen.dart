import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../theme/app_colors.dart';

class LegalDocumentScreen extends StatelessWidget {
  const LegalDocumentScreen({
    super.key,
    required this.title,
    required this.assetPath,
  });

  final String title;
  final String assetPath;

  Future<void> _openLink(String? href) async {
    if (href == null || href.isEmpty) return;
    final uri = Uri.tryParse(href);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: FutureBuilder<String>(
        future: DefaultAssetBundle.of(context).loadString(assetPath),
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || snapshot.data == null) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'Unable to load this document. Please try again later.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.text),
                ),
              ),
            );
          }

          return Markdown(
            data: snapshot.data!,
            selectable: true,
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
            onTapLink: (text, href, title) => _openLink(href),
            styleSheet: MarkdownStyleSheet.fromTheme(theme).copyWith(
              p: const TextStyle(
                fontSize: 15,
                height: 1.55,
                color: AppColors.text,
              ),
              h1: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                height: 1.3,
                color: AppColors.textH,
              ),
              h2: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                height: 1.35,
                color: AppColors.textH,
              ),
              h3: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                height: 1.4,
                color: AppColors.textH,
              ),
              strong: const TextStyle(
                fontWeight: FontWeight.w700,
                color: AppColors.textH,
              ),
              a: const TextStyle(
                color: AppColors.accent,
                decoration: TextDecoration.underline,
                decorationColor: AppColors.accent,
              ),
              listBullet: const TextStyle(
                fontSize: 15,
                height: 1.55,
                color: AppColors.text,
              ),
              listIndent: 24,
              blockSpacing: 12,
              horizontalRuleDecoration: const BoxDecoration(
                border: Border(
                  top: BorderSide(color: AppColors.border, width: 1),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const LegalDocumentScreen(
      title: 'Privacy Policy',
      assetPath: 'assets/privacy_policy.md',
    );
  }
}

class TermsOfServiceScreen extends StatelessWidget {
  const TermsOfServiceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const LegalDocumentScreen(
      title: 'Terms of Service',
      assetPath: 'assets/terms_of_service.md',
    );
  }
}
