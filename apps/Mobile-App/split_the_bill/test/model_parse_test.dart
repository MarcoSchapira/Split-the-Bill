import 'package:flutter_test/flutter_test.dart';
import 'package:split_the_bill/models/models.dart';

void main() {
  test('Bill.fromJson accepts group with only id and name', () {
    final bill = Bill.fromJson({
      'id': '1',
      'description': 'test',
      'incurredAt': '2026-06-11T00:00:00.000Z',
      'totalCents': 1000,
      'targetType': 'group',
      'friendshipId': null,
      'groupId': 'g1',
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
      'group': {'id': 'g1', 'name': 'Dinner'},
      'friendship': null,
      'shares': [],
      'canEdit': true,
      'canDelete': true,
      'canRetarget': false,
    });

    expect(bill.group?.name, 'Dinner');
  });

  test('GroupInvitation.fromJson accepts group with only id and name', () {
    final invite = GroupInvitation.fromJson({
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
      'group': {'id': 'g1', 'name': 'Dinner'},
    });

    expect(invite.groupRef.name, 'Dinner');
  });
}
