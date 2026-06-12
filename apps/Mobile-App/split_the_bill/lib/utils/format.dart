import 'package:intl/intl.dart';
import '../models/user.dart';

final _cadFormat = NumberFormat.currency(locale: 'en_CA', symbol: r'$');

String formatCad(int cents) {
  return _cadFormat.format(cents / 100);
}

String displayName(User user) {
  return user.name ?? user.email;
}

String formatDateUtc(String isoDate) {
  final date = DateTime.parse(isoDate);
  return DateFormat.yMMMd().format(DateTime.utc(date.year, date.month, date.day));
}

String formatRelativeTime(String isoDate) {
  final date = DateTime.parse(isoDate).toLocal();
  final diff = DateTime.now().difference(date);
  if (diff.inMinutes < 1) return 'Just now';
  if (diff.inHours < 1) return '${diff.inMinutes}m ago';
  if (diff.inDays < 1) return '${diff.inHours}h ago';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  return DateFormat.yMMMd().format(date);
}
