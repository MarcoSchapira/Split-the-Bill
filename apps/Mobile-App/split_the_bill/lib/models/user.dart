class User {
  const User({
    required this.id,
    required this.email,
    required this.name,
    required this.createdAt,
    this.aiReceiptConsentAt,
  });

  final String id;
  final String email;
  final String? name;
  final String createdAt;
  final String? aiReceiptConsentAt;

  bool get hasAiReceiptConsent {
    final value = aiReceiptConsentAt;
    return value != null && value.isNotEmpty && value != 'null';
  }

  factory User.fromJson(Map<String, dynamic> json) {
    final rawConsent = json['aiReceiptConsentAt'];
    String? consentAt;
    if (rawConsent is String && rawConsent.isNotEmpty) {
      consentAt = rawConsent;
    } else if (rawConsent != null) {
      final asString = rawConsent.toString();
      if (asString.isNotEmpty && asString != 'null') {
        consentAt = asString;
      }
    }
    return User(
      id: json['id'] as String,
      email: json['email'] as String,
      name: json['name'] as String?,
      createdAt: json['createdAt'] as String,
      aiReceiptConsentAt: consentAt,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'name': name,
        'createdAt': createdAt,
        'aiReceiptConsentAt': aiReceiptConsentAt,
      };
}
