class Env {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );

  static const String mobileClientHeader = 'X-EquiSplit-Client';
  static const String mobileClientValue = 'mobile';
}
