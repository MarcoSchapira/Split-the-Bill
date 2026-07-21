import 'package:flutter_test/flutter_test.dart';
import 'package:billcompass/models/models.dart';
import 'package:billcompass/models/user.dart';
import 'package:billcompass/theme/app_colors.dart';
import 'package:billcompass/utils/request_items.dart';
import 'package:billcompass/utils/settlement_status.dart';

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
        'lenderId': share.lenderId,
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

  test('requestSettlementStatusLabel covers all debtor and lender states', () {
    expect(
      requestSettlementStatusLabel(
        payerMarkedAsPaid: false,
        lenderConfirmedPaid: false,
        role: RequestRole.debtor,
      ),
      'Not paid',
    );
    expect(
      requestSettlementStatusLabel(
        payerMarkedAsPaid: true,
        lenderConfirmedPaid: false,
        role: RequestRole.debtor,
      ),
      'pending lender confirmation',
    );
    expect(
      requestSettlementStatusLabel(
        payerMarkedAsPaid: false,
        lenderConfirmedPaid: true,
        role: RequestRole.debtor,
      ),
      'Lender marked as paid',
    );
    expect(
      requestSettlementStatusLabel(
        payerMarkedAsPaid: false,
        lenderConfirmedPaid: false,
        role: RequestRole.lender,
      ),
      'Not paid',
    );
    expect(
      requestSettlementStatusLabel(
        payerMarkedAsPaid: true,
        lenderConfirmedPaid: false,
        role: RequestRole.lender,
      ),
      'Pending your confirmation',
    );
    expect(
      requestSettlementStatusLabel(
        payerMarkedAsPaid: false,
        lenderConfirmedPaid: true,
        role: RequestRole.lender,
      ),
      'Paid and confirmed',
    );
  });

  test('requestSettlementBarColor uses yellow for pending state', () {
    expect(
      requestSettlementBarColor(
        payerMarkedAsPaid: false,
        lenderConfirmedPaid: false,
        role: RequestRole.debtor,
      ),
      AppColors.surfaceMuted,
    );
    expect(
      requestSettlementBarColor(
        payerMarkedAsPaid: true,
        lenderConfirmedPaid: false,
        role: RequestRole.debtor,
      ),
      AppColors.pendingText,
    );
    expect(
      requestSettlementBarColor(
        payerMarkedAsPaid: true,
        lenderConfirmedPaid: false,
        role: RequestRole.lender,
      ),
      AppColors.pendingText,
    );
    expect(
      requestSettlementBarColor(
        payerMarkedAsPaid: false,
        lenderConfirmedPaid: true,
        role: RequestRole.lender,
      ),
      AppColors.accent,
    );
  });

  test('requestSettlementProgress and action visibility cover all states', () {
    expect(
      requestSettlementProgress(
        payerMarkedAsPaid: false,
        lenderConfirmedPaid: false,
      ),
      0.0,
    );
    expect(
      requestSettlementProgress(
        payerMarkedAsPaid: true,
        lenderConfirmedPaid: false,
      ),
      0.5,
    );
    expect(
      requestSettlementProgress(
        payerMarkedAsPaid: false,
        lenderConfirmedPaid: true,
      ),
      1.0,
    );

    expect(
      canShowRequestMarkPaidAction(
        payerMarkedAsPaid: false,
        lenderConfirmedPaid: false,
        role: RequestRole.debtor,
      ),
      isTrue,
    );
    expect(
      canShowRequestMarkPaidAction(
        payerMarkedAsPaid: true,
        lenderConfirmedPaid: false,
        role: RequestRole.debtor,
      ),
      isFalse,
    );
    expect(
      canShowRequestMarkPaidAction(
        payerMarkedAsPaid: false,
        lenderConfirmedPaid: false,
        role: RequestRole.lender,
      ),
      isTrue,
    );
    expect(
      canShowRequestMarkPaidAction(
        payerMarkedAsPaid: true,
        lenderConfirmedPaid: false,
        role: RequestRole.lender,
      ),
      isTrue,
    );
    expect(
      canShowRequestMarkPaidAction(
        payerMarkedAsPaid: true,
        lenderConfirmedPaid: true,
        role: RequestRole.lender,
      ),
      isFalse,
    );

    expect(
      showDebtorMarkedBadge(
        payerMarkedAsPaid: true,
        lenderConfirmedPaid: false,
        role: RequestRole.debtor,
      ),
      isTrue,
    );
    expect(
      showDebtorMarkedBadge(
        payerMarkedAsPaid: true,
        lenderConfirmedPaid: false,
        role: RequestRole.lender,
      ),
      isFalse,
    );
  });

  test('requestMarkPaidActionLabel varies by role', () {
    expect(requestMarkPaidActionLabel(RequestRole.debtor), 'Mark as paid');
    expect(requestMarkPaidActionLabel(RequestRole.lender), 'Confirm paid');
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
    expect(items.every((item) => item.role == RequestRole.lender), isTrue);
    expect(items.map((item) => item.shareId).toSet(), {'s2', 's3'});
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
    expect(items.first.role, RequestRole.debtor);
    expect(items.first.shareId, 's2');
  });

  test('lenderId-based filtering shows owed rows when user is lender', () {
    final bills = [
      _bill(
        id: 'b1',
        description: 'Trip',
        incurredAt: '2026-06-11T00:00:00.000Z',
        payer: friendA,
        shares: [
          _share(
            id: 's1',
            user: friendB,
            shareCents: 900,
            lenderId: payer.id,
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
    expect(items.first.counterparty.id, friendB.id);
    expect(items.first.role, RequestRole.lender);
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
      requestSettlementProgress(
        payerMarkedAsPaid: items.first.payerMarkedAsPaid,
        lenderConfirmedPaid: items.first.lenderConfirmedPaid,
      ),
      1.0,
    );
  });

  test('excludes lender-confirmed requests when includePassedRequests is false', () {
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
          _share(id: 's3', user: friendB, shareCents: 400),
        ],
      ),
    ];

    final filtered = requestItemsFromBills(
      bills: bills,
      currentUserId: payer.id,
      direction: RequestDirection.owedToYou,
      includePassedRequests: false,
    );
    final unfiltered = requestItemsFromBills(
      bills: bills,
      currentUserId: payer.id,
      direction: RequestDirection.owedToYou,
    );

    expect(filtered.length, 1);
    expect(filtered.first.counterparty.id, friendB.id);
    expect(unfiltered.length, 2);
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

  test('requestItemsForFriend returns both directions for one friend only', () {
    final bills = [
      _bill(
        id: 'owed-a',
        description: 'Blake owes you',
        incurredAt: '2026-06-11T00:00:00.000Z',
        payer: payer,
        shares: [
          _share(id: 's1', user: payer, shareCents: 1000),
          _share(id: 's2', user: friendA, shareCents: 500),
          _share(id: 's3', user: friendB, shareCents: 500),
        ],
      ),
      _bill(
        id: 'you-owe-a',
        description: 'You owe Blake',
        incurredAt: '2026-06-10T00:00:00.000Z',
        payer: friendA,
        shares: [
          _share(id: 's4', user: friendA, shareCents: 800, lenderId: friendA.id),
          _share(id: 's5', user: payer, shareCents: 400, lenderId: friendA.id),
        ],
      ),
    ];

    final items = requestItemsForFriend(
      bills: bills,
      currentUserId: payer.id,
      friendUserId: friendA.id,
      includePassedRequests: true,
    );

    expect(items.length, 2);
    expect(items.every((item) => item.counterparty.id == friendA.id), isTrue);
    expect(
      items.map((item) => item.direction).toSet(),
      {RequestDirection.owedToYou, RequestDirection.youOwe},
    );
  });

  test('requestItemsForFriend respects includePassedRequests', () {
    final bills = [
      _bill(
        id: 'passed',
        description: 'Passed',
        incurredAt: '2026-06-11T00:00:00.000Z',
        payer: payer,
        shares: [
          _share(id: 's1', user: payer, shareCents: 600),
          _share(
            id: 's2',
            user: friendA,
            shareCents: 600,
            lenderConfirmedPaid: true,
          ),
        ],
      ),
      _bill(
        id: 'open',
        description: 'Open',
        incurredAt: '2026-06-10T00:00:00.000Z',
        payer: payer,
        shares: [
          _share(id: 's3', user: payer, shareCents: 400),
          _share(id: 's4', user: friendA, shareCents: 400),
        ],
      ),
    ];

    final filtered = requestItemsForFriend(
      bills: bills,
      currentUserId: payer.id,
      friendUserId: friendA.id,
    );
    final unfiltered = requestItemsForFriend(
      bills: bills,
      currentUserId: payer.id,
      friendUserId: friendA.id,
      includePassedRequests: true,
    );

    expect(filtered.length, 1);
    expect(filtered.first.billId, 'open');
    expect(unfiltered.length, 2);
  });

  test('friendNetBalanceCents matches dashboard status rules', () {
    final items = [
      RequestItem(
        shareId: 's1',
        billId: 'b1',
        billLabel: 'Lunch',
        incurredAt: '2026-06-11T00:00:00.000Z',
        counterparty: friendA,
        amountCents: 500,
        payerMarkedAsPaid: false,
        lenderConfirmedPaid: false,
        direction: RequestDirection.owedToYou,
        role: RequestRole.lender,
      ),
      RequestItem(
        shareId: 's1b',
        billId: 'b1b',
        billLabel: 'Pending owed to you',
        incurredAt: '2026-06-11T01:00:00.000Z',
        counterparty: friendA,
        amountCents: 150,
        payerMarkedAsPaid: true,
        lenderConfirmedPaid: false,
        direction: RequestDirection.owedToYou,
        role: RequestRole.lender,
      ),
      RequestItem(
        shareId: 's2',
        billId: 'b2',
        billLabel: 'Coffee',
        incurredAt: '2026-06-10T00:00:00.000Z',
        counterparty: friendA,
        amountCents: 200,
        payerMarkedAsPaid: false,
        lenderConfirmedPaid: false,
        direction: RequestDirection.youOwe,
        role: RequestRole.debtor,
      ),
      RequestItem(
        shareId: 's2b',
        billId: 'b2b',
        billLabel: 'Pending you owe',
        incurredAt: '2026-06-10T01:00:00.000Z',
        counterparty: friendA,
        amountCents: 80,
        payerMarkedAsPaid: true,
        lenderConfirmedPaid: false,
        direction: RequestDirection.youOwe,
        role: RequestRole.debtor,
      ),
      RequestItem(
        shareId: 's3',
        billId: 'b3',
        billLabel: 'Settled',
        incurredAt: '2026-06-09T00:00:00.000Z',
        counterparty: friendA,
        amountCents: 1000,
        payerMarkedAsPaid: true,
        lenderConfirmedPaid: true,
        direction: RequestDirection.owedToYou,
        role: RequestRole.lender,
      ),
    ];

    // +500 unpaid owed-to-you
    // +150 pending owed-to-you (still counts)
    // -200 unpaid you-owe
    // pending you-owe and settled excluded
    expect(friendNetBalanceCents(items), 450);
    expect(friendAwaitingConfirmationCents(items), 80);
  });

  test('requestDirectionTotalsFromBills matches owed-to-you and you-owe rules', () {
    final bills = [
      _bill(
        id: 'b1',
        description: 'Groceries',
        incurredAt: '2026-07-13T00:00:00.000Z',
        payer: payer,
        shares: [
          _share(id: 's-payer', user: payer, shareCents: 1000),
          _share(
            id: 's-unpaid',
            user: friendA,
            shareCents: 4000,
            payerMarkedAsPaid: false,
          ),
          _share(
            id: 's-pending',
            user: friendB,
            shareCents: 2500,
            payerMarkedAsPaid: true,
          ),
          _share(
            id: 's-settled',
            user: friendA,
            shareCents: 1500,
            payerMarkedAsPaid: true,
            lenderConfirmedPaid: true,
          ),
        ],
      ),
      _bill(
        id: 'b2',
        description: 'Dinner',
        incurredAt: '2026-07-12T00:00:00.000Z',
        payer: friendA,
        shares: [
          _share(
            id: 's-i-owe-unpaid',
            user: payer,
            shareCents: 3000,
            lenderId: friendA.id,
          ),
          _share(
            id: 's-i-owe-pending',
            user: payer,
            shareCents: 1200,
            lenderId: friendA.id,
            payerMarkedAsPaid: true,
          ),
          _share(
            id: 's-other',
            user: friendB,
            shareCents: 800,
            lenderId: friendA.id,
          ),
        ],
      ),
    ];

    final owedToYou = requestDirectionTotalsFromBills(
      bills: bills,
      currentUserId: payer.id,
      direction: RequestDirection.owedToYou,
    );
    expect(owedToYou.totalCents, 6500);
    expect(owedToYou.pendingConfirmationCents, 2500);

    final youOwe = requestDirectionTotalsFromBills(
      bills: bills,
      currentUserId: payer.id,
      direction: RequestDirection.youOwe,
    );
    expect(youOwe.totalCents, 3000);
    expect(youOwe.pendingConfirmationCents, 1200);
  });
}
