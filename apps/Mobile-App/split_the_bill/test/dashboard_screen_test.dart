import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:billcompass/api/api_client.dart';
import 'package:billcompass/api/domain_api.dart';
import 'package:billcompass/models/models.dart';
import 'package:billcompass/models/user.dart';
import 'package:billcompass/providers/providers.dart';
import 'package:billcompass/screens/dashboard/dashboard_screen.dart';

class _FakeDashboardApi extends DashboardApi {
  _FakeDashboardApi(this.dashboard) : super(ApiClient());

  final Dashboard dashboard;

  @override
  Future<Dashboard> getDashboard() async => dashboard;
}

class _FakeFriendsApi extends FriendsApi {
  _FakeFriendsApi(this.friends) : super(ApiClient());

  final List<FriendshipSummary> friends;

  @override
  Future<List<FriendshipSummary>> listFriends() async => friends;
}

class _FakeInvitationsApi extends InvitationsApi {
  _FakeInvitationsApi(this.invitations) : super(ApiClient());

  final Invitations invitations;

  @override
  Future<Invitations> getInvitations() async => invitations;

  @override
  Future<FriendInvitation> answerFriendInvitation(
    String invitationId,
    String decision,
  ) async {
    return invitations.receivedFriends.first;
  }

  @override
  Future<void> cancelFriendInvitation(String invitationId) async {}
}

User _user(String id, String email, {String? name}) {
  return User(
    id: id,
    email: email,
    name: name,
    createdAt: '2026-01-01T00:00:00.000Z',
  );
}

void main() {
  testWidgets('shows manage button and opens manage friends sheet', (tester) async {
    final friends = [
      FriendshipSummary(
        id: 'friendship-a',
        createdAt: '2026-01-01T00:00:00.000Z',
        friend: _user('user-a', 'alice@example.com', name: 'Alice'),
      ),
      FriendshipSummary(
        id: 'friendship-b',
        createdAt: '2026-01-01T00:00:00.000Z',
        friend: _user('user-b', 'bob@example.com', name: 'Bob'),
      ),
    ];
    final dashboard = Dashboard(
      totalOwedToYouCents: 400,
      totalYouOweCents: 200,
      netBalanceCents: 200,
      owedToYouPendingConfirmationPercent: 50,
      youOwePendingConfirmationPercent: 25,
      balances: [
        BalanceContact(
          user: _user('user-b', 'bob@example.com', name: 'Bob'),
          relationship: 'friend',
          friendshipId: 'friendship-b',
          balanceCents: -200,
        ),
      ],
      groupBalances: const [],
    );
    final invitations = Invitations(
      receivedFriends: [
        FriendInvitation(
          id: 'invite-1',
          status: InvitationStatus.pending,
          createdAt: '2026-01-01T00:00:00.000Z',
          respondedAt: null,
          recipientEmail: 'me@example.com',
          sender: _user('user-c', 'charlie@example.com', name: 'Charlie'),
          recipient: _user('me', 'me@example.com', name: 'Me'),
        ),
      ],
      sentFriends: [
        FriendInvitation(
          id: 'invite-2',
          status: InvitationStatus.pending,
          createdAt: '2026-01-01T00:00:00.000Z',
          respondedAt: null,
          recipientEmail: 'dana@example.com',
          sender: _user('me', 'me@example.com', name: 'Me'),
          recipient: _user('user-d', 'dana@example.com', name: 'Dana'),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          friendsApiProvider.overrideWithValue(_FakeFriendsApi(friends)),
          dashboardApiProvider.overrideWithValue(_FakeDashboardApi(dashboard)),
          invitationsApiProvider.overrideWithValue(_FakeInvitationsApi(invitations)),
        ],
        child: const MaterialApp(home: DashboardScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Manage friends'), findsOneWidget);
    expect(find.text('50%'), findsOneWidget);
    expect(find.text('25%'), findsOneWidget);
    expect(find.text('awaiting'), findsNWidgets(2));
    expect(find.text('confirmation'), findsNWidgets(2));
    expect(find.text('alice@example.com'), findsOneWidget);
    expect(find.text('bob@example.com'), findsOneWidget);

    await tester.tap(find.text('Manage friends'));
    await tester.pumpAndSettle();

    expect(find.text('Wants to be friends'), findsWidgets);
    expect(find.text('Pending invitations'), findsOneWidget);
    expect(find.text('Swipe left on a sent invitation to cancel.'), findsOneWidget);
    expect(find.text('Invitation sent'), findsOneWidget);
    expect(find.text('Pending'), findsOneWidget);
    expect(find.text('Dana'), findsOneWidget);
  });
}
