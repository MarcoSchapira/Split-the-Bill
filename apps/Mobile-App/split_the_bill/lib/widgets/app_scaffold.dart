import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/providers.dart';
import 'common_widgets.dart';

class AppScaffold extends ConsumerWidget {
  const AppScaffold({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const tabs = [
    ('Dashboard', Icons.dashboard_outlined, Icons.dashboard),
    ('Activity', Icons.history, Icons.history),
    ('Bills', Icons.receipt_long_outlined, Icons.receipt_long),
    ('Friends', Icons.people_outline, Icons.people),
  ];

  static const tabRootPaths = {
    '/dashboard',
    '/activity',
    '/bills',
    '/friends',
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = GoRouter.of(context);

    return ListenableBuilder(
      listenable: router.routerDelegate,
      builder: (context, _) {
        final index = navigationShell.currentIndex;
        final location = router.state.uri.path;
        final isTabRoot = tabRootPaths.contains(location);

        return Scaffold(
          appBar: isTabRoot
              ? AppBar(
                  title: const AppBrandTitle(),
                  actions: [
                    PopupMenuButton<String>(
                      onSelected: (value) async {
                        switch (value) {
                          case 'settings':
                            context.push('/settings');
                          case 'logout':
                            await ref.read(authProvider.notifier).logout();
                            if (context.mounted) context.go('/login');
                        }
                      },
                      itemBuilder: (context) => [
                        const PopupMenuItem(value: 'settings', child: Text('Settings')),
                        const PopupMenuItem(value: 'logout', child: Text('Log out')),
                      ],
                    ),
                  ],
                )
              : null,
          body: navigationShell,
          bottomNavigationBar: NavigationBar(
            selectedIndex: index,
            onDestinationSelected: (selectedIndex) {
              navigationShell.goBranch(
                selectedIndex,
                initialLocation: selectedIndex == index,
              );
            },
            destinations: [
              for (final tab in tabs)
                NavigationDestination(
                  icon: Icon(tab.$2),
                  selectedIcon: Icon(tab.$3),
                  label: tab.$1,
                ),
            ],
          ),
        );
      },
    );
  }
}
