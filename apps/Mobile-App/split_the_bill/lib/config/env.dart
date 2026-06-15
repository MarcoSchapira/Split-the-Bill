class Env {
  static const String productionApiBaseUrl =
      'https://split-the-bill-api-1099488675893.northamerica-northeast2.run.app';

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );

  static const String mobileClientHeader = 'X-EquiSplit-Client';
  static const String mobileClientValue = 'mobile';

  static bool get isLocalDev {
    return apiBaseUrl.contains('localhost') ||
        apiBaseUrl.contains('10.0.2.2') ||
        apiBaseUrl.contains('127.0.0.1');
  }
}
