import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/providers.dart';
import '../screens/requests/requests_screen.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/register_screen.dart';
import '../screens/bills/bills_screen.dart';
import '../screens/bills/edit_bill_screen.dart';
import '../screens/capture/manual_receipt_screen.dart';
import '../screens/activity/activity_screen.dart';
import '../screens/dashboard/dashboard_screen.dart';
import '../screens/groups/groups_screen.dart';
import '../screens/groups/group_detail_screen.dart';
import '../screens/friends/friends_screen.dart';
import '../screens/invitations/invitations_screen.dart';
import '../screens/settings/legal_placeholder_screen.dart';
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
      final isAuthRoute =
          state.matchedLocation == '/login' ||
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
        path: '/settings',
        builder: (_, __) => const SettingsScreen(),
        routes: [
          GoRoute(
            path: 'privacy',
            builder: (_, __) => const PrivacyPolicyScreen(),
          ),
          GoRoute(
            path: 'terms',
            builder: (_, __) => const TermsOfServiceScreen(),
          ),
        ],
      ),
      StatefulShellRoute.indexedStack(
        builder: (_, __, navigationShell) =>
            AppScaffold(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/dashboard',
                builder: (_, __) => const DashboardScreen(),
                routes: [
                  GoRoute(
                    path: 'activity',
                    builder: (_, __) => const ActivityScreen(),
                  ),
                  GoRoute(
                    path: 'capture',
                    redirect: (_, state) =>
                        state.uri.path == '/dashboard/capture'
                        ? '/dashboard'
                        : null,
                    routes: [
                      GoRoute(
                        path: 'manual',
                        builder: (_, state) {
                          final extra = state.extra;
                          String? initialGroupId;
                          List<int>? imageBytes;
                          if (extra is Map<String, dynamic>) {
                            initialGroupId = extra['groupId'] as String?;
                            final rawImage = extra['imageBytes'];
                            if (rawImage is List<int>) {
                              imageBytes = rawImage;
                            }
                          } else if (extra is List<int>) {
                            imageBytes = extra;
                          }
                          return ManualReceiptScreen(
                            imageBytes: imageBytes,
                            initialGroupId: initialGroupId,
                          );
                        },
                      ),
                    ],
                  ),
                ],
              ),
              GoRoute(
                path: '/friends/invites',
                builder: (_, __) => const InvitationsScreen(),
              ),
              GoRoute(
                path: '/friends/:friendshipId',
                builder: (_, state) => FriendDetailScreen(
                  friendshipId: state.pathParameters['friendshipId']!,
                ),
              ),
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
                path: '/requests',
                builder: (_, state) => RequestsScreen(
                  initialTab: state.uri.queryParameters['tab'],
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/groups',
                builder: (_, __) => const GroupsScreen(),
                routes: [
                  GoRoute(
                    path: ':groupId',
                    builder: (_, state) => GroupDetailScreen(
                      groupId: state.pathParameters['groupId']!,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
    errorBuilder: (_, __) =>
        const Scaffold(body: Center(child: Text('Page not found'))),
  );
});

class _AuthRefreshListenable extends ChangeNotifier {
  _AuthRefreshListenable(this.ref) {
    ref.listen<AuthState>(authProvider, (_, __) => notifyListeners());
  }

  final Ref ref;
}
