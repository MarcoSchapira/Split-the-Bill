import 'package:flutter_test/flutter_test.dart';
import 'package:split_the_bill/models/models.dart';
import 'package:split_the_bill/models/user.dart';
import 'package:split_the_bill/utils/bill_flow_from_bill.dart';

void main() {
  test('billFlowFromBill accepts bills without line items', () {
    const currentUser = User(
      id: 'u1',
      email: 'a@b.com',
      name: 'Alice',
      createdAt: '2026-06-11T00:00:00.000Z',
    );

    final bill = Bill.fromJson({
      'id': 'b1',
      'description': 'Dinner',
      'incurredAt': '2026-06-11T00:00:00.000Z',
      'totalCents': 4200,
      'targetType': null,
      'source': 'manual',
      'friendshipId': null,
      'payerId': 'u1',
      'creatorId': 'u1',
      'createdAt': '2026-06-11T00:00:00.000Z',
      'lastEditedAt': '2026-06-11T00:00:00.000Z',
      'payer': {
        'id': 'u1',
        'email': 'a@b.com',
        'name': 'Alice',
        'createdAt': '2026-06-11T00:00:00.000Z',
      },
      'creator': {
        'id': 'u1',
        'email': 'a@b.com',
        'name': 'Alice',
        'createdAt': '2026-06-11T00:00:00.000Z',
      },
      'friendship': null,
      'shares': [
        {
          'id': 's1',
          'shareCents': 4200,
          'settledAt': null,
          'user': {
            'id': 'u1',
            'email': 'a@b.com',
            'name': 'Alice',
            'createdAt': '2026-06-11T00:00:00.000Z',
          },
        },
      ],
      'userSummary': {'amountCents': 0, 'direction': 'none', 'settled': false},
      'lineItems': [],
      'canEdit': true,
      'canDelete': true,
      'canRetarget': false,
    });

    final flow = billFlowFromBill(bill: bill, currentUser: currentUser);

    expect(flow.billId, 'b1');
    expect(flow.receipt?.items, isEmpty);
    expect(flow.receipt?.total, 42);
    expect(flow.participants.map((user) => user.id), ['u1']);
    expect(flow.assignments, isEmpty);
  });
}
