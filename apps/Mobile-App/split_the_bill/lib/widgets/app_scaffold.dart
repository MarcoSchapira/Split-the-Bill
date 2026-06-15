import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/providers.dart';
import '../theme/app_colors.dart';
import 'common_widgets.dart';
import 'modals/add_friend_sheet.dart';
import 'modals/create_group_sheet.dart';

class AppScaffold extends ConsumerWidget {
  const AppScaffold({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const tabs = [
    ('Dashboard', Icons.dashboard_outlined, Icons.dashboard),
    ('Activity', Icons.history, Icons.history),
    ('Friends', Icons.people_outline, Icons.people),
    ('Groups', Icons.groups_outlined, Icons.groups),
    ('Invitations', Icons.mail_outline, Icons.mail),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final index = navigationShell.currentIndex;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Eyebrow('EquiSplit'),
            Text(
              AppScaffold.tabs[index].$1,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
          ],
        ),
        actions: [
          PopupMenuButton<String>(
            onSelected: (value) async {
              switch (value) {
                case 'friend':
                  await showModalBottomSheet<void>(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: AppColors.surface,
                    shape: const RoundedRectangleBorder(
                      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                    ),
                    builder: (_) => const AddFriendSheet(),
                  );
                case 'group':
                  await showModalBottomSheet<void>(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: AppColors.surface,
                    shape: const RoundedRectangleBorder(
                      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                    ),
                    builder: (_) => const CreateGroupSheet(),
                  );
                case 'logout':
                  await ref.read(authProvider.notifier).logout();
                  if (context.mounted) context.go('/login');
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(value: 'friend', child: Text('Add friend')),
              const PopupMenuItem(value: 'group', child: Text('Create group')),
              const PopupMenuItem(value: 'logout', child: Text('Log out')),
            ],
          ),
        ],
      ),
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: navigationShell.goBranch,
        destinations: [
          for (final tab in tabs)
            NavigationDestination(
              icon: Icon(tab.$2),
              selectedIcon: Icon(tab.$3),
              label: tab.$1,
            ),
        ],
      ),
      floatingActionButton: index == 0
          ? Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  FloatingActionButton.extended(
                    heroTag: 'capture-fab',
                    onPressed: () => context.push('/dashboard/capture'),
                    backgroundColor: AppColors.accent,
                    foregroundColor: Colors.white,
                    icon: const Icon(Icons.camera_alt),
                    label: const Text('Capture'),
                  ),
                  FloatingActionButton.extended(
                    heroTag: 'add-bill-fab',
                    onPressed: () => context.push('/dashboard/add-bill'),
                    backgroundColor: AppColors.accent,
                    foregroundColor: Colors.white,
                    icon: const Icon(Icons.add),
                    label: const Text('Add bill'),
                  ),
                ],
              ),
            )
          : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }
}
