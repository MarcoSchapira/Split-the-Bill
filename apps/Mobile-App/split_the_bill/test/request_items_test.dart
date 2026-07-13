import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:split_the_bill/models/models.dart';
import 'package:split_the_bill/models/user.dart';
import 'package:split_the_bill/theme/app_colors.dart';
import 'package:split_the_bill/utils/request_items.dart';
import 'package:split_the_bill/utils/settlement_status.dart';

User _user(String id, {String? name, String email = 'user@example.com'}) {
  return User(
    id: id,
    email: email,
    name: name,
    createdAt: '2026-06-11T00:00:00.000Z',
  );
}

BillShare _share({
  required String id,
  required User user,
  required int shareCents,
  String lenderId = 'u1',
  bool payerMarkedAsPaid = false,
  bool lenderConfirmedPaid = false,
}) {
  return BillShare.fromJson({
    'id': id,
    'shareCents': shareCents,
    'lenderId': lenderId,
    'payerMarkedAsPaid': payerMarkedAsPaid,
    'lenderConfirmedPaid': lenderConfirmedPaid,
    'user': user.toJson(),
  });
}

Bill _bill({
  required String id,
  required String description,
  required String incurredAt,
  required User payer,
  required List<BillShare> shares,
}) {
  return Bill.fromJson({
    'id': id,
    'description': description,
    'incurredAt': incurredAt,
    'totalCents': shares.fold<int>(0, (sum, share) => sum + share.shareCents),
    'payerId': payer.id,
    'creatorId': payer.id,
    'source': 'manual',
    'createdAt': incurredAt,
    'lastEditedAt': incurredAt,
    'payer': payer.toJson(),
    'creator': payer.toJson(),
    'shares': shares.map((share) {
      return {
        'id': share.id,
        'shareCents': share.shareCents,
        'lenderId': payer.id,
        'payerMarkedAsPaid': share.payerMarkedAsPaid,
        'lenderConfirmedPaid': share.lenderConfirmedPaid,
        'user': share.user.toJson(),
      };
    }).toList(),
    'userSummary': {'amountCents': 0, 'direction': 'none', 'settled': false},
    'lineItems': [],
    'canEdit': true,
    'canDelete': true,
    'canRetarget': false,
  });
}

void main() {
  final payer = _user('u1', name: 'Alex');
  final friendA = _user('u2', name: 'Blake');
  final friendB = _user('u3', name: 'Casey');

  test('requestRelationshipTitle formats both directions', () {
    expect(
      requestRelationshipTitle(
        direction: RequestDirection.owedToYou,
        counterpartyName: 'Blake',
      ),
      'Blake owes you',
    );
    expect(
      requestRelationshipTitle(
        direction: RequestDirection.youOwe,
        counterpartyName: 'Alex',
      ),
      'You owe Alex',
    );
  });

  test('requestAmountDirectionLabel formats both directions', () {
    expect(
      requestAmountDirectionLabel(RequestDirection.owedToYou),
      'you are owed',
    );
    expect(requestAmountDirectionLabel(RequestDirection.youOwe), 'you owe');
  });

  test('settlementStatusDetailLabel covers all statuses', () {
    expect(
      settlementStatusDetailLabel(
        payerMarkedAsPaid: false,
        lenderConfirmedPaid: false,
        counterpartyName: 'Blake',
        direction: RequestDirection.owedToYou,
      ),
      'Not paid',
    );
    expect(
      settlementStatusDetailLabel(
        payerMarkedAsPaid: true,
        lenderConfirmedPaid: false,
        counterpartyName: 'Blake',
        direction: RequestDirection.owedToYou,
      ),
      'Blake marked as paid',
    );
    expect(
      settlementStatusDetailLabel(
        payerMarkedAsPaid: true,
        lenderConfirmedPaid: false,
        counterpartyName: 'Alex',
        direction: RequestDirection.youOwe,
      ),
      'You marked as paid',
    );
    expect(
      settlementStatusDetailLabel(
        payerMarkedAsPaid: false,
        lenderConfirmedPaid: true,
        counterpartyName: 'Blake',
        direction: RequestDirection.owedToYou,
      ),
      'Paid and confirmed',
    );
  });

  test('settlementStatusColor is universal and not tab-dependent', () {
    expect(
      settlementStatusColor(
        payerMarkedAsPaid: false,
        lenderConfirmedPaid: false,
      ),
      AppColors.error,
    );
    expect(
      settlementStatusColor(
        payerMarkedAsPaid: true,
        lenderConfirmedPaid: false,
      ),
      AppColors.pendingText,
    );
    expect(
      settlementStatusColor(
        payerMarkedAsPaid: false,
        lenderConfirmedPaid: true,
      ),
      AppColors.accent,
    );
    expect(
      settlementStatusColor(
        payerMarkedAsPaid: false,
        lenderConfirmedPaid: false,
      ),
      isNot(AppColors.brandSoft),
    );
  });

  test('payer sees one row per debtor on a group bill', () {
    final bills = [
      _bill(
        id: 'b1',
        description: 'Dinner',
        incurredAt: '2026-06-11T00:00:00.000Z',
        payer: payer,
        shares: [
          _share(id: 's1', user: payer, shareCents: 2000),
          _share(id: 's2', user: friendA, shareCents: 1500),
          _share(id: 's3', user: friendB, shareCents: 2500),
        ],
      ),
    ];

    final items = requestItemsFromBills(
      bills: bills,
      currentUserId: payer.id,
      direction: RequestDirection.owedToYou,
    );

    expect(items.length, 2);
    expect(items.map((item) => item.counterparty.id).toSet(), {'u2', 'u3'});
    expect(items.map((item) => item.amountCents).toSet(), {1500, 2500});
  });

  test('non-payer sees one row owed to payer', () {
    final bills = [
      _bill(
        id: 'b1',
        description: 'Coffee',
        incurredAt: '2026-06-11T00:00:00.000Z',
        payer: payer,
        shares: [
          _share(id: 's1', user: payer, shareCents: 800),
          _share(id: 's2', user: friendA, shareCents: 400),
          _share(id: 's3', user: friendB, shareCents: 400),
        ],
      ),
    ];

    final items = requestItemsFromBills(
      bills: bills,
      currentUserId: friendA.id,
      direction: RequestDirection.youOwe,
    );

    expect(items.length, 1);
    expect(items.first.counterparty.id, payer.id);
    expect(items.first.amountCents, 400);
  });

  test('zero-share participants are excluded', () {
    final bills = [
      _bill(
        id: 'b1',
        description: 'Split',
        incurredAt: '2026-06-11T00:00:00.000Z',
        payer: payer,
        shares: [
          _share(id: 's1', user: payer, shareCents: 1000),
          _share(id: 's2', user: friendA, shareCents: 0),
        ],
      ),
    ];

    final items = requestItemsFromBills(
      bills: bills,
      currentUserId: payer.id,
      direction: RequestDirection.owedToYou,
    );

    expect(items, isEmpty);
  });

  test('settled shares are included with paid status', () {
    final bills = [
      _bill(
        id: 'b1',
        description: 'Lunch',
        incurredAt: '2026-06-11T00:00:00.000Z',
        payer: payer,
        shares: [
          _share(id: 's1', user: payer, shareCents: 1200),
          _share(
            id: 's2',
            user: friendA,
            shareCents: 600,
            lenderConfirmedPaid: true,
          ),
        ],
      ),
    ];

    final items = requestItemsFromBills(
      bills: bills,
      currentUserId: payer.id,
      direction: RequestDirection.owedToYou,
    );

    expect(items.length, 1);
    expect(items.first.lenderConfirmedPaid, isTrue);
    expect(
      settlementProgress(
        payerMarkedAsPaid: items.first.payerMarkedAsPaid,
        lenderConfirmedPaid: items.first.lenderConfirmedPaid,
      ),
      1.0,
    );
  });

  test('sorts unpaid before paid then by newest bill first', () {
    final bills = [
      _bill(
        id: 'old-paid',
        description: 'Old paid',
        incurredAt: '2026-06-01T00:00:00.000Z',
        payer: payer,
        shares: [
          _share(id: 's1', user: payer, shareCents: 500),
          _share(
            id: 's2',
            user: friendA,
            shareCents: 500,
            lenderConfirmedPaid: true,
          ),
        ],
      ),
      _bill(
        id: 'new-unpaid',
        description: 'New unpaid',
        incurredAt: '2026-06-10T00:00:00.000Z',
        payer: payer,
        shares: [
          _share(id: 's3', user: payer, shareCents: 700),
          _share(id: 's4', user: friendB, shareCents: 700),
        ],
      ),
      _bill(
        id: 'mid-pending',
        description: 'Pending',
        incurredAt: '2026-06-05T00:00:00.000Z',
        payer: payer,
        shares: [
          _share(id: 's5', user: payer, shareCents: 300),
          _share(
            id: 's6',
            user: friendA,
            shareCents: 300,
            payerMarkedAsPaid: true,
          ),
        ],
      ),
    ];

    final items = requestItemsFromBills(
      bills: bills,
      currentUserId: payer.id,
      direction: RequestDirection.owedToYou,
    );

    expect(items.map((item) => item.billId), [
      'new-unpaid',
      'mid-pending',
      'old-paid',
    ]);
  });
}
