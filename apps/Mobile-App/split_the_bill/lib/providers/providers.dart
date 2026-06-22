import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user.dart';
import '../api/api_client.dart';
import '../api/auth_api.dart';
import '../api/domain_api.dart';
import '../api/token_storage.dart';

final tokenStorageProvider = Provider<TokenStorage>((ref) => TokenStorage());

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(tokenStorage: ref.watch(tokenStorageProvider));
});

final authApiProvider = Provider<AuthApi>((ref) {
  return AuthApi(ref.watch(apiClientProvider), ref.watch(tokenStorageProvider));
});

final dashboardApiProvider = Provider<DashboardApi>((ref) {
  return DashboardApi(ref.watch(apiClientProvider));
});

final friendsApiProvider = Provider<FriendsApi>((ref) {
  return FriendsApi(ref.watch(apiClientProvider));
});

final billsApiProvider = Provider<BillsApi>((ref) {
  return BillsApi(ref.watch(apiClientProvider));
});

final invitationsApiProvider = Provider<InvitationsApi>((ref) {
  return InvitationsApi(ref.watch(apiClientProvider));
});

final activityApiProvider = Provider<ActivityApi>((ref) {
  return ActivityApi(ref.watch(apiClientProvider));
});

final receiptsApiProvider = Provider<ReceiptsApi>((ref) {
  return ReceiptsApi(ref.watch(apiClientProvider));
});

class AuthState {
  const AuthState({
    required this.user,
    required this.isLoading,
  });

  final User? user;
  final bool isLoading;

  bool get isAuthenticated => user != null;

  AuthState copyWith({User? user, bool? isLoading, bool clearUser = false}) {
    return AuthState(
      user: clearUser ? null : (user ?? this.user),
      isLoading: isLoading ?? this.isLoading,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier(this._authApi, this._storage, ApiClient apiClient)
      : super(const AuthState(user: null, isLoading: true)) {
    apiClient.setOnSessionExpired(_handleSessionExpired);
    _restoreSession();
  }

  final AuthApi _authApi;
  final TokenStorage _storage;

  void _handleSessionExpired() {
    state = const AuthState(user: null, isLoading: false);
  }

  Future<void> _restoreSession() async {
    try {
      final accessToken = await _storage.getAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        state = const AuthState(user: null, isLoading: false);
        return;
      }

      final storedUser = await _authApi.getStoredUser();
      if (storedUser != null) {
        state = AuthState(user: storedUser, isLoading: true);
      }

      final user = await _authApi.getCurrentUser();
      await _storage.saveUserJson(jsonEncode(user.toJson()));
      state = AuthState(user: user, isLoading: false);
    } catch (_) {
      await _storage.clear();
      state = const AuthState(user: null, isLoading: false);
    }
  }

  Future<void> login({required String email, required String password}) async {
    final auth = await _authApi.login(email: email, password: password);
    await _authApi.persistAuth(auth);
    state = AuthState(user: auth.user, isLoading: false);
  }

  Future<void> register({
    required String email,
    required String password,
    required String code,
    String? name,
  }) async {
    final auth = await _authApi.register(
      email: email,
      password: password,
      code: code,
      name: name,
    );
    await _authApi.persistAuth(auth);
    state = AuthState(user: auth.user, isLoading: false);
  }

  Future<void> logout() async {
    await _authApi.logout();
    state = const AuthState(user: null, isLoading: false);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(
    ref.watch(authApiProvider),
    ref.watch(tokenStorageProvider),
    ref.watch(apiClientProvider),
  );
});

final dataRefreshProvider = StateProvider<int>((ref) => 0);

void notifyDataChanged(WidgetRef ref) {
  ref.read(dataRefreshProvider.notifier).state++;
}
