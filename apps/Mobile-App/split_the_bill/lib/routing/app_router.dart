import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/providers.dart';
import '../screens/activity/activity_screen.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/register_screen.dart';
import '../models/receipt.dart';
import '../screens/capture/capture_camera_screen.dart';
import '../screens/capture/capture_confirm_screen.dart';
import '../screens/capture/capture_participants_screen.dart';
import '../screens/capture/capture_split_screen.dart';
import '../screens/dashboard/dashboard_screen.dart';
import '../screens/friends/friends_screen.dart';
import '../screens/groups/groups_screen.dart';
import '../screens/invitations/invitations_screen.dart';
import '../widgets/app_scaffold.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/dashboard',
    refreshListenable: _AuthRefreshListenable(ref),
    redirect: (context, state) {
      final isLoading = auth.isLoading;
      final isAuthenticated = auth.isAuthenticated;
      final isAuthRoute = state.matchedLocation == '/login' ||
          state.matchedLocation == '/register';

      if (isLoading) return null;

      if (!isAuthenticated && !isAuthRoute) return '/login';
      if (isAuthenticated && isAuthRoute) return '/dashboard';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
      GoRoute(
        path: '/dashboard/add-bill',
        builder: (_, __) => const DashboardAddBillScreen(),
      ),
      GoRoute(
        path: '/dashboard/capture',
        builder: (_, __) => const CaptureCameraScreen(),
      ),
      GoRoute(
        path: '/dashboard/capture/participants',
        builder: (_, state) => CaptureParticipantsScreen(
          flow: state.extra! as CaptureFlowState,
        ),
      ),
      GoRoute(
        path: '/dashboard/capture/split',
        builder: (_, state) => CaptureSplitScreen(
          flow: state.extra! as CaptureFlowState,
        ),
      ),
      GoRoute(
        path: '/dashboard/capture/confirm',
        builder: (_, state) => CaptureConfirmScreen(
          flow: state.extra! as CaptureFlowState,
        ),
      ),
      GoRoute(
        path: '/friends/:friendshipId',
        builder: (_, state) => FriendDetailScreen(
          friendshipId: state.pathParameters['friendshipId']!,
        ),
      ),
      GoRoute(
        path: '/groups/:groupId',
        builder: (_, state) => GroupDetailScreen(
          groupId: state.pathParameters['groupId']!,
        ),
      ),
      StatefulShellRoute.indexedStack(
        builder: (_, __, navigationShell) => AppScaffold(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/dashboard', builder: (_, __) => const DashboardScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/activity', builder: (_, __) => const ActivityScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/friends', builder: (_, __) => const FriendsScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/groups', builder: (_, __) => const GroupsScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/invitations', builder: (_, __) => const InvitationsScreen()),
            ],
          ),
        ],
      ),
    ],
    errorBuilder: (_, __) => const Scaffold(
      body: Center(child: Text('Page not found')),
    ),
  );
});

class _AuthRefreshListenable extends ChangeNotifier {
  _AuthRefreshListenable(this.ref) {
    ref.listen<AuthState>(authProvider, (_, __) => notifyListeners());
  }

  final Ref ref;
}
