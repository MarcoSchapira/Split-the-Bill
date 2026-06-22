import 'package:flutter_test/flutter_test.dart';
import 'package:split_the_bill/models/models.dart';

void main() {
  test('Bill.fromJson accepts friendship target', () {
    final bill = Bill.fromJson({
      'id': '1',
      'description': 'test',
      'incurredAt': '2026-06-11T00:00:00.000Z',
      'totalCents': 1000,
      'targetType': 'friendship',
      'friendshipId': 'f1',
      'payerId': 'u1',
      'creatorId': 'u1',
      'source': 'manual',
      'createdAt': '2026-06-11T00:00:00.000Z',
      'lastEditedAt': '2026-06-11T00:00:00.000Z',
      'payer': {
        'id': 'u1',
        'email': 'a@b.com',
        'name': null,
        'createdAt': '2026-06-11T00:00:00.000Z',
      },
      'creator': {
        'id': 'u1',
        'email': 'a@b.com',
        'name': null,
        'createdAt': '2026-06-11T00:00:00.000Z',
      },
      'friendship': null,
      'shares': [],
      'userSummary': {'amountCents': 0, 'direction': 'none', 'settled': false},
      'lineItems': [],
      'canEdit': true,
      'canDelete': true,
      'canRetarget': false,
    });

    expect(bill.targetType, TargetType.friendship);
    expect(bill.friendshipId, 'f1');
  });

  test('Invitations.fromJson accepts friend invitation lists', () {
    final invites = Invitations.fromJson({
      'receivedFriends': [
        {
          'id': '1',
          'status': 'pending',
          'createdAt': '2026-06-11T00:00:00.000Z',
          'respondedAt': null,
          'recipientEmail': 'x@y.com',
          'sender': {
            'id': 'u1',
            'email': 'a@b.com',
            'name': null,
            'createdAt': '2026-06-11T00:00:00.000Z',
          },
          'recipient': null,
        },
      ],
      'sentFriends': [],
    });

    expect(invites.receivedFriends.length, 1);
    expect(invites.receivedFriends.first.sender.email, 'a@b.com');
  });

  test('ActivityEvent.fromJson accepts friend invitation payload', () {
    final event = ActivityEvent.fromJson({
      'id': '1',
      'type': 'FRIEND_INVITATION_SENT',
      'message': 'sent a friend invitation',
      'createdAt': '2026-06-11T00:00:00.000Z',
      'billId': null,
      'friendInvitationId': 'fi_1',
      'friendshipId': null,
      'actor': {
        'id': 'u1',
        'email': 'a@b.com',
        'name': null,
        'createdAt': '2026-06-11T00:00:00.000Z',
      },
    });

    expect(event.friendInvitationId, 'fi_1');
  });
}
