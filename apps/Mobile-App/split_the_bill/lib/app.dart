import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'providers/providers.dart';
import 'routing/app_router.dart';
import 'theme/app_theme.dart';
import 'widgets/common_widgets.dart';

class EquiShareApp extends ConsumerWidget {
  const EquiShareApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    if (auth.isLoading) {
      return MaterialApp(
        theme: AppTheme.light(),
        home: const Scaffold(body: LoadingView(message: 'Restoring your session...')),
      );
    }

    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'EquiShare',
      theme: AppTheme.light(),
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
