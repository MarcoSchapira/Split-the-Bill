class User {
  const User({
    required this.id,
    required this.email,
    required this.name,
    required this.createdAt,
  });

  final String id;
  final String email;
  final String? name;
  final String createdAt;

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      email: json['email'] as String,
      name: json['name'] as String?,
      createdAt: json['createdAt'] as String,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'name': name,
        'createdAt': createdAt,
      };
}
