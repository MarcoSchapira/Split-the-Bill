import 'package:dio/dio.dart';
import '../config/env.dart';
import 'api_exception.dart';
import 'token_storage.dart';

class ApiClient {
  ApiClient({TokenStorage? tokenStorage})
      : _tokenStorage = tokenStorage ?? TokenStorage(),
        _dio = Dio(
          BaseOptions(
            baseUrl: Env.apiBaseUrl,
            connectTimeout: const Duration(seconds: 15),
            receiveTimeout: const Duration(seconds: 15),
            headers: {
              Env.mobileClientHeader: Env.mobileClientValue,
              'Content-Type': 'application/json',
            },
          ),
        ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: _onRequest,
        onError: _onError,
      ),
    );
  }

  final Dio _dio;
  final TokenStorage _tokenStorage;
  bool _refreshInFlight = false;
  void Function()? _onSessionExpired;

  Dio get dio => _dio;

  void setOnSessionExpired(void Function() callback) {
    _onSessionExpired = callback;
  }

  Future<void> _clearSession() async {
    await _tokenStorage.clear();
    _onSessionExpired?.call();
  }

  Future<void> _onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final accessToken = await _tokenStorage.getAccessToken();
    if (accessToken != null && accessToken.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $accessToken';
    }
    handler.next(options);
  }

  bool _isAuthExempt(String path) {
    return path.contains('/auth/login') ||
        path.contains('/auth/register') ||
        path.contains('/auth/register/send-code');
  }

  Future<void> _onError(
    DioException error,
    ErrorInterceptorHandler handler,
  ) async {
    final statusCode = error.response?.statusCode;
    final path = error.requestOptions.path;

    if (statusCode != 401 || _isAuthExempt(path) || _refreshInFlight) {
      handler.next(_wrapError(error));
      return;
    }

    _refreshInFlight = true;
    try {
      final refreshToken = await _tokenStorage.getRefreshToken();
      if (refreshToken == null || refreshToken.isEmpty) {
        await _clearSession();
        handler.next(_wrapError(error));
        return;
      }

      final refreshResponse = await _dio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
        options: Options(
          headers: {Env.mobileClientHeader: Env.mobileClientValue},
          extra: {'skipAuth': true},
        ),
      );

      final data = refreshResponse.data;
      final newAccess = data?['accessToken'] as String?;
      final newRefresh = data?['refreshToken'] as String?;
      if (newAccess == null || newRefresh == null) {
        await _clearSession();
        handler.next(_wrapError(error));
        return;
      }

      await _tokenStorage.saveTokens(
        accessToken: newAccess,
        refreshToken: newRefresh,
      );

      final retryOptions = error.requestOptions;
      retryOptions.headers['Authorization'] = 'Bearer $newAccess';
      final retryResponse = await _dio.fetch(retryOptions);
      handler.resolve(retryResponse);
    } catch (_) {
      await _clearSession();
      handler.next(_wrapError(error));
    } finally {
      _refreshInFlight = false;
    }
  }

  DioException _wrapError(DioException error) {
    final response = error.response;
    if (response == null) {
      return DioException(
        requestOptions: error.requestOptions,
        error: ApiException(message: 'Unable to connect to the server.'),
        type: error.type,
      );
    }

    final data = response.data;
    if (data is Map<String, dynamic>) {
      final errorBody = data['error'];
      if (errorBody is Map<String, dynamic>) {
        return DioException(
          requestOptions: error.requestOptions,
          response: response,
          error: ApiException(
            message: errorBody['message'] as String? ?? 'Request failed.',
            code: errorBody['code'] as String?,
            statusCode: response.statusCode,
          ),
          type: error.type,
        );
      }
    }

    return error;
  }

  Never throwApiError(DioException error, [String fallback = 'Request failed.']) {
    final wrapped = error.error;
    if (wrapped is ApiException) throw wrapped;
    throw ApiException(message: fallback, statusCode: error.response?.statusCode);
  }
}