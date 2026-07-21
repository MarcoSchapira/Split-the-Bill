import 'package:flutter_test/flutter_test.dart';
import 'package:billcompass/models/models.dart';
import 'package:billcompass/models/user.dart';
import 'package:billcompass/utils/dashboard_people.dart';

User _user(String id, String email, {String? name}) {
  return User(
    id: id,
    email: email,
    name: name,
    createdAt: '2026-01-01T00:00:00.000Z',
  );
}

FriendshipSummary _friendship({
  required String id,
  required String email,
  String? name,
}) {
  return FriendshipSummary(
    id: id,
    createdAt: '2026-01-01T00:00:00.000Z',
    friend: _user('user-$id', email, name: name),
  );
}

void main() {
  group('buildDashboardPeople', () {
    test('includes all friends even without dashboard balances', () {
      final friends = [
        _friendship(id: 'friendship-a', email: 'alice@example.com', name: 'Alice'),
        _friendship(id: 'friendship-b', email: 'bob@example.com', name: 'Bob'),
      ];
      final dashboard = Dashboard(
        totalOwedToYouCents: 0,
        totalYouOweCents: 0,
        netBalanceCents: 0,
        owedToYouPendingConfirmationPercent: null,
        youOwePendingConfirmationPercent: null,
        balances: const [],
        groupBalances: const [],
      );

      final people = buildDashboardPeople(friends: friends, dashboard: dashboard);

      expect(people.length, 2);
      expect(people.map((person) => person.friendship.id), ['friendship-a', 'friendship-b']);
      expect(people.map((person) => person.balanceCents), [0, 0]);
    });

    test('sorts by absolute balance descending regardless of direction', () {
      final friends = [
        _friendship(id: 'friendship-a', email: 'alice@example.com', name: 'Alice'),
        _friendship(id: 'friendship-b', email: 'bob@example.com', name: 'Bob'),
        _friendship(id: 'friendship-c', email: 'carol@example.com', name: 'Carol'),
      ];
      final dashboard = Dashboard(
        totalOwedToYouCents: 0,
        totalYouOweCents: 0,
        netBalanceCents: 0,
        owedToYouPendingConfirmationPercent: null,
        youOwePendingConfirmationPercent: null,
        balances: [
          BalanceContact(
            user: _user('user-a', 'alice@example.com', name: 'Alice'),
            relationship: 'friend',
            friendshipId: 'friendship-a',
            balanceCents: 500,
          ),
          BalanceContact(
            user: _user('user-b', 'bob@example.com', name: 'Bob'),
            relationship: 'friend',
            friendshipId: 'friendship-b',
            balanceCents: -900,
          ),
          BalanceContact(
            user: _user('user-c', 'carol@example.com', name: 'Carol'),
            relationship: 'friend',
            friendshipId: 'friendship-c',
            balanceCents: 200,
          ),
        ],
        groupBalances: const [],
      );

      final people = buildDashboardPeople(friends: friends, dashboard: dashboard);

      expect(people.map((person) => person.friendship.id), [
        'friendship-b',
        'friendship-a',
        'friendship-c',
      ]);
      expect(people.map((person) => person.balanceCents), [-900, 500, 200]);
    });
  });
}
