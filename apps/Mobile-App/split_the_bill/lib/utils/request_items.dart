import '../models/models.dart';
import '../models/user.dart';
import 'settlement_status.dart';

enum RequestDirection { owedToYou, youOwe }

enum RequestRole { debtor, lender }

class RequestItem {
  const RequestItem({
    required this.shareId,
    required this.billId,
    required this.billLabel,
    required this.incurredAt,
    required this.counterparty,
    required this.amountCents,
    required this.payerMarkedAsPaid,
    required this.lenderConfirmedPaid,
    required this.direction,
    required this.role,
  });

  final String shareId;
  final String billId;
  final String billLabel;
  final String incurredAt;
  final User counterparty;
  final int amountCents;
  final bool payerMarkedAsPaid;
  final bool lenderConfirmedPaid;
  final RequestDirection direction;
  final RequestRole role;
}

String requestRelationshipTitle({
  required RequestDirection direction,
  required String counterpartyName,
}) {
  return switch (direction) {
    RequestDirection.owedToYou => '$counterpartyName owes you',
    RequestDirection.youOwe => 'You owe $counterpartyName',
  };
}

String requestAmountDirectionLabel(RequestDirection direction) {
  return switch (direction) {
    RequestDirection.owedToYou => 'you are owed',
    RequestDirection.youOwe => 'you owe',
  };
}

String _billLabel(Bill bill) {
  final description = bill.description.trim();
  if (description.isNotEmpty) return description;

  final storeName = bill.storeName?.trim();
  if (storeName != null && storeName.isNotEmpty) return storeName;

  return 'Bill';
}

User? _lenderUserForShare(Bill bill, BillShare share) {
  if (share.lenderId == bill.payer.id) return bill.payer;
  for (final otherShare in bill.shares) {
    if (otherShare.user.id == share.lenderId) return otherShare.user;
  }
  return null;
}

List<RequestItem> requestItemsFromBills({
  required List<Bill> bills,
  required String currentUserId,
  required RequestDirection direction,
}) {
  final items = <RequestItem>[];

  for (final bill in bills) {
    final label = _billLabel(bill);

    for (final share in bill.shares) {
      if (share.shareCents <= 0) continue;

      if (direction == RequestDirection.owedToYou) {
        if (share.lenderId != currentUserId ||
            share.user.id == currentUserId) {
          continue;
        }

        items.add(
          RequestItem(
            shareId: share.id,
            billId: bill.id,
            billLabel: label,
            incurredAt: bill.incurredAt,
            counterparty: share.user,
            amountCents: share.shareCents,
            payerMarkedAsPaid: share.payerMarkedAsPaid,
            lenderConfirmedPaid: share.lenderConfirmedPaid,
            direction: direction,
            role: RequestRole.lender,
          ),
        );
        continue;
      }

      if (share.user.id != currentUserId || share.lenderId == currentUserId) {
        continue;
      }

      final lender = _lenderUserForShare(bill, share);
      if (lender == null) continue;

      items.add(
        RequestItem(
          shareId: share.id,
          billId: bill.id,
          billLabel: label,
          incurredAt: bill.incurredAt,
          counterparty: lender,
          amountCents: share.shareCents,
          payerMarkedAsPaid: share.payerMarkedAsPaid,
          lenderConfirmedPaid: share.lenderConfirmedPaid,
          direction: direction,
          role: RequestRole.debtor,
        ),
      );
    }
  }

  items.sort((left, right) {
    final statusCompare = settlementSortOrder(
      payerMarkedAsPaid: left.payerMarkedAsPaid,
      lenderConfirmedPaid: left.lenderConfirmedPaid,
    ).compareTo(
      settlementSortOrder(
        payerMarkedAsPaid: right.payerMarkedAsPaid,
        lenderConfirmedPaid: right.lenderConfirmedPaid,
      ),
    );
    if (statusCompare != 0) return statusCompare;

    return right.incurredAt.compareTo(left.incurredAt);
  });

  return items;
}
