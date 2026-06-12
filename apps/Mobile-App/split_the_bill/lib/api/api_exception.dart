class ApiException implements Exception {
  ApiException({
    required this.message,
    this.code,
    this.statusCode,
  });

  final String message;
  final String? code;
  final int? statusCode;

  @override
  String toString() => message;
}

String apiErrorMessage(Object error, [String fallback = 'Something went wrong. Please try again.']) {
  if (error is ApiException) {
    if (error.code == 'USER_NOT_FOUND') {
      return 'Invitation sent.';
    }
    return error.message;
  }
  return fallback;
}
