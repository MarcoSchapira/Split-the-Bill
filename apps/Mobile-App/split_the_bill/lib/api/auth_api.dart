import 'dart:convert';

import 'package:dio/dio.dart';
import '../models/models.dart';
import '../models/user.dart';
import 'api_client.dart';
import 'api_exception.dart';
import 'token_storage.dart';

class AuthApi {
  AuthApi(this._client, this._storage);

  final ApiClient _client;
  final TokenStorage _storage;

  Future<void> sendRegistrationCode(String email) async {
    try {
      await _client.dio.post('/auth/register/send-code', data: {'email': email});
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to send verification code.');
    }
  }

  Future<AuthResponse> login({required String email, required String password}) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/auth/login',
        data: {'email': email, 'password': password},
      );
      return _parseAuthResponse(response.data!);
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to log in.');
    }
  }

  Future<AuthResponse> register({
    required String email,
    required String password,
    required String code,
    String? name,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/auth/register',
        data: {
          'email': email,
          'password': password,
          'code': code,
          if (name != null && name.isNotEmpty) 'name': name,
        },
      );
      return _parseAuthResponse(response.data!);
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to register.');
    }
  }

  Future<User> getCurrentUser() async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>('/auth/me');
      return User.fromJson(response.data!['user'] as Map<String, dynamic>);
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to load user.');
    }
  }

  Future<void> logout() async {
    try {
      await _client.dio.post('/auth/logout');
    } on DioException {
      // Ignore logout errors.
    } finally {
      await _storage.clear();
    }
  }

  AuthResponse _parseAuthResponse(Map<String, dynamic> data) {
    final accessToken = data['accessToken'] as String? ?? data['token'] as String?;
    final refreshToken = data['refreshToken'] as String?;
    if (accessToken == null || refreshToken == null) {
      throw ApiException(message: 'Authentication tokens missing from server response.');
    }
    return AuthResponse(
      user: User.fromJson(data['user'] as Map<String, dynamic>),
      tokens: AuthTokens(accessToken: accessToken, refreshToken: refreshToken),
    );
  }

  Future<void> persistAuth(AuthResponse auth) async {
    await _storage.saveTokens(
      accessToken: auth.tokens.accessToken,
      refreshToken: auth.tokens.refreshToken,
    );
    await _storage.saveUserJson(jsonEncode(auth.user.toJson()));
  }

  Future<User?> getStoredUser() async {
    final json = await _storage.getStoredUserJson();
    if (json == null) return null;
    return User.fromJson(jsonDecode(json) as Map<String, dynamic>);
  }
}
