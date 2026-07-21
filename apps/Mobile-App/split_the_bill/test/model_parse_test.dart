import 'package:flutter_test/flutter_test.dart';
import 'package:billcompass/models/models.dart';

void main() {
  test('Bill.fromJson parses participant-based bills', () {
    final bill = Bill.fromJson({
      'id': '1',
      'description': 'test',
      'incurredAt': '2026-06-11T00:00:00.000Z',
      'totalCents': 1000,
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
      'shares': [],
      'userSummary': {'amountCents': 0, 'direction': 'none', 'settled': false},
      'lineItems': [],
      'canEdit': true,
      'canDelete': true,
      'canRetarget': false,
    });

    expect(bill.description, 'test');
    expect(bill.source, BillSource.manual);
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

  test('BillShare.fromJson parses settlement bools and lenderId', () {
    final paid = BillShare.fromJson({
      'id': 's1',
      'shareCents': 500,
      'lenderId': 'u1',
      'payerMarkedAsPaid': true,
      'lenderConfirmedPaid': true,
      'user': {
        'id': 'u1',
        'email': 'a@b.com',
        'name': null,
        'createdAt': '2026-06-11T00:00:00.000Z',
      },
    });
    final notPaid = BillShare.fromJson({
      'id': 's2',
      'shareCents': 500,
      'lenderId': 'u1',
      'user': {
        'id': 'u2',
        'email': 'c@d.com',
        'name': null,
        'createdAt': '2026-06-11T00:00:00.000Z',
      },
    });

    expect(paid.payerMarkedAsPaid, isTrue);
    expect(paid.lenderConfirmedPaid, isTrue);
    expect(paid.lenderId, 'u1');
    expect(notPaid.payerMarkedAsPaid, isFalse);
    expect(notPaid.lenderConfirmedPaid, isFalse);
    expect(notPaid.lenderId, 'u1');
  });
}
