import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'providers/providers.dart';
import 'routing/app_router.dart';
import 'theme/app_theme.dart';
import 'widgets/common_widgets.dart';

class BillCompassApp extends ConsumerWidget {
  const BillCompassApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    if (auth.isLoading) {
      return MaterialApp(
        theme: AppTheme.light(),
        debugShowCheckedModeBanner: false,
        home: const Scaffold(
          backgroundColor: Color(0xFF0B745D),
          body: SessionLoadingView(),
        ),
      );
    }

    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'BillCompass',
      theme: AppTheme.light(),
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
