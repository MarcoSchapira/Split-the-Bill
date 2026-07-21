import 'package:flutter_test/flutter_test.dart';
import 'package:billcompass/models/user.dart';
import 'package:billcompass/utils/bill_split.dart';

void main() {
  group('equalShareCents', () {
    test('splits remainder across first participants', () {
      final shares = equalShareCents(100, ['b', 'a', 'c']);
      expect(shares.map((s) => s.userId).toList(), ['a', 'b', 'c']);
      expect(shares.map((s) => s.shareCents).toList(), [34, 33, 33]);
    });
  });

  group('buildSharesFromMemberState', () {
    test('returns null shares for full equal split', () {
      final members = [
        MemberSplitState(
          user: _user('1'),
          included: true,
          amount: '',
          percent: '',
        ),
        MemberSplitState(
          user: _user('2'),
          included: true,
          amount: '',
          percent: '',
        ),
      ];

      final result = buildSharesFromMemberState(
        totalCents: 1000,
        splitKind: SplitKind.equal,
        customMode: CustomSplitMode.amount,
        members: members,
      );

      expect(result.error, isNull);
      expect(result.shares, isNull);
    });

    test('validates custom amounts total', () {
      final members = [
        MemberSplitState(
          user: _user('1'),
          included: true,
          amount: '4.00',
          percent: '',
        ),
        MemberSplitState(
          user: _user('2'),
          included: true,
          amount: '3.00',
          percent: '',
        ),
      ];

      final result = buildSharesFromMemberState(
        totalCents: 1000,
        splitKind: SplitKind.custom,
        customMode: CustomSplitMode.amount,
        members: members,
      );

      expect(result.error, 'Custom amounts must add up to the bill total.');
    });
  });
}

User _user(String id) {
  return User(id: id, email: '$id@example.com', name: null, createdAt: '2026-01-01T00:00:00.000Z');
}
