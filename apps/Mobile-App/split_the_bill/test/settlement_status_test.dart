import 'package:flutter_test/flutter_test.dart';
import 'package:billcompass/models/models.dart';
import 'package:billcompass/models/user.dart';
import 'package:billcompass/theme/app_colors.dart';
import 'package:billcompass/utils/settlement_status.dart';

User _user(String id, {String? name}) {
  return User(
    id: id,
    email: '$id@example.com',
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
  required User payer,
  required List<BillShare> shares,
}) {
  const incurredAt = '2026-06-11T00:00:00.000Z';
  return Bill.fromJson({
    'id': 'bill-1',
    'description': 'Dinner',
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
  final friendC = _user('u4', name: 'Drew');

  group('billSettlementState', () {
    test('maps unpaid, pending, and settled from share flags', () {
      expect(
        billSettlementState(
          payerMarkedAsPaid: false,
          lenderConfirmedPaid: false,
        ),
        BillSettlementState.unpaid,
      );
      expect(
        billSettlementState(
          payerMarkedAsPaid: true,
          lenderConfirmedPaid: false,
        ),
        BillSettlementState.pending,
      );
      expect(
        billSettlementState(
          payerMarkedAsPaid: true,
          lenderConfirmedPaid: true,
        ),
        BillSettlementState.settled,
      );
      expect(
        billSettlementState(
          payerMarkedAsPaid: false,
          lenderConfirmedPaid: true,
        ),
        BillSettlementState.settled,
      );
    });

    test('billShareSettlementState treats payer share as settled', () {
      final payerShare = _share(
        id: 's-payer',
        user: payer,
        shareCents: 0,
        payerMarkedAsPaid: false,
        lenderConfirmedPaid: false,
      );
      expect(
        billShareSettlementState(payerShare, payerId: payer.id),
        BillSettlementState.settled,
      );
    });
  });

  group('billSettlementStatusLabel and colors', () {
    test('uses paid / paid - pending / not paid labels', () {
      expect(
        billSettlementStatusLabel(BillSettlementState.settled),
        'paid',
      );
      expect(
        billSettlementStatusLabel(BillSettlementState.pending),
        'paid - pending',
      );
      expect(
        billSettlementStatusLabel(BillSettlementState.unpaid),
        'not paid',
      );
    });

    test('uses accent / pending / error colors', () {
      expect(
        billSettlementStatusColor(BillSettlementState.settled),
        AppColors.accent,
      );
      expect(
        billSettlementStatusColor(BillSettlementState.pending),
        AppColors.pendingText,
      );
      expect(
        billSettlementStatusColor(BillSettlementState.unpaid),
        AppColors.error,
      );
      expect(
        billSettlementStatusBackground(BillSettlementState.pending),
        AppColors.pendingBg,
      );
    });
  });

  group('bill debtor metrics', () {
    test('counts settled, pending, and unpaid debtors separately', () {
      final bill = _bill(
        payer: payer,
        shares: [
          _share(id: 's1', user: payer, shareCents: 0),
          _share(
            id: 's2',
            user: friendA,
            shareCents: 1000,
            lenderConfirmedPaid: true,
          ),
          _share(
            id: 's3',
            user: friendB,
            shareCents: 1000,
            payerMarkedAsPaid: true,
          ),
          _share(id: 's4', user: friendC, shareCents: 1000),
        ],
      );
      final debtors = billDebtorShares(bill);

      expect(debtors, hasLength(3));
      expect(billSettledDebtorCount(debtors), 1);
      expect(billPendingDebtorCount(debtors), 1);
      expect(billUnpaidDebtorCount(debtors), 1);
      expect(billAllDebtorsSettled(debtors), isFalse);
      expect(billAmountStillOwedToPayer(debtors), 2000);
    });

    test('progress averages 0 / 0.5 / 1 per debtor share', () {
      final debtors = [
        _share(
          id: 's2',
          user: friendA,
          shareCents: 1000,
          lenderConfirmedPaid: true,
        ),
        _share(
          id: 's3',
          user: friendB,
          shareCents: 1000,
          payerMarkedAsPaid: true,
        ),
        _share(id: 's4', user: friendC, shareCents: 1000),
      ];

      expect(billDebtorProgress(debtors), closeTo(1.5 / 3, 0.0001));
    });

    test('empty debtors are fully settled with full progress', () {
      expect(billAllDebtorsSettled(const []), isTrue);
      expect(billDebtorProgress(const []), 1.0);
      expect(billAmountStillOwedToPayer(const []), 0);
    });

    test('payer collecting subtitle separates unpaid and pending', () {
      expect(
        billPayerCollectingSubtitle(unpaidCount: 2, pendingCount: 0),
        'Waiting on 2 people to pay you back',
      );
      expect(
        billPayerCollectingSubtitle(unpaidCount: 0, pendingCount: 1),
        '1 payment pending your confirmation',
      );
      expect(
        billPayerCollectingSubtitle(unpaidCount: 1, pendingCount: 2),
        'Waiting on 1 person to pay you back · '
        '2 payments pending your confirmation',
      );
    });
  });
}
