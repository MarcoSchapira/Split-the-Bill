import 'package:shared_preferences/shared_preferences.dart';

class AiReceiptConsentStorage {
  static String _key(String userId) => 'ai_receipt_consent_$userId';

  Future<bool> hasConsent(String userId) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_key(userId)) ?? false;
  }

  Future<void> setConsent(String userId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_key(userId), true);
  }
}
