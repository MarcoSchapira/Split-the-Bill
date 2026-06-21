import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/providers.dart';
import '../screens/activity/activity_screen.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/register_screen.dart';
import '../screens/bills/bills_screen.dart';
import '../screens/bills/edit_bill_screen.dart';
import '../models/receipt.dart';
import '../screens/capture/capture_camera_screen.dart';
import '../screens/capture/capture_confirm_screen.dart';
import '../screens/capture/capture_participants_screen.dart';
import '../screens/capture/capture_split_screen.dart';
import '../screens/dashboard/dashboard_screen.dart';
import '../screens/friends/friends_screen.dart';
import '../screens/invitations/invitations_screen.dart';
import '../screens/settings/settings_screen.dart';
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
      GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
      StatefulShellRoute.indexedStack(
        builder: (_, __, navigationShell) => AppScaffold(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/dashboard',
                builder: (_, __) => const DashboardScreen(),
                routes: [
                  GoRoute(
                    path: 'capture',
                    builder: (_, __) => const CaptureCameraScreen(),
                    routes: [
                      GoRoute(
                        path: 'participants',
                        builder: (_, state) => CaptureParticipantsScreen(
                          flow: state.extra! as BillFlowState,
                        ),
                      ),
                      GoRoute(
                        path: 'split',
                        builder: (_, state) => CaptureSplitScreen(
                          flow: state.extra! as BillFlowState,
                        ),
                      ),
                      GoRoute(
                        path: 'confirm',
                        builder: (_, state) => CaptureConfirmScreen(
                          flow: state.extra! as BillFlowState,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/activity', builder: (_, __) => const ActivityScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/bills',
                builder: (_, __) => const BillsScreen(),
                routes: [
                  GoRoute(
                    path: ':billId',
                    builder: (_, state) => BillDetailScreen(
                      billId: state.pathParameters['billId']!,
                    ),
                    routes: [
                      GoRoute(
                        path: 'edit',
                        builder: (_, state) => EditBillScreen(
                          billId: state.pathParameters['billId']!,
                        ),
                        routes: [
                          GoRoute(
                            path: 'split',
                            builder: (_, state) => CaptureSplitScreen(
                              flow: state.extra! as BillFlowState,
                            ),
                          ),
                          GoRoute(
                            path: 'confirm',
                            builder: (_, state) => CaptureConfirmScreen(
                              flow: state.extra! as BillFlowState,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/friends',
                builder: (_, __) => const FriendsScreen(),
                routes: [
                  GoRoute(
                    path: 'invites',
                    builder: (_, __) => const InvitationsScreen(),
                  ),
                  GoRoute(
                    path: ':friendshipId',
                    builder: (_, state) => FriendDetailScreen(
                      friendshipId: state.pathParameters['friendshipId']!,
                    ),
                  ),
                ],
              ),
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
