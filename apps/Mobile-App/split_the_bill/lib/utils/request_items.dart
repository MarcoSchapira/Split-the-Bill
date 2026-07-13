import '../models/models.dart';
import '../models/user.dart';
import 'settlement_status.dart';

enum RequestDirection { owedToYou, youOwe }

class RequestItem {
  const RequestItem({
    required this.billId,
    required this.billLabel,
    required this.incurredAt,
    required this.counterparty,
    required this.amountCents,
    required this.payerMarkedAsPaid,
    required this.lenderConfirmedPaid,
    required this.direction,
  });

  final String billId;
  final String billLabel;
  final String incurredAt;
  final User counterparty;
  final int amountCents;
  final bool payerMarkedAsPaid;
  final bool lenderConfirmedPaid;
  final RequestDirection direction;
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

List<RequestItem> requestItemsFromBills({
  required List<Bill> bills,
  required String currentUserId,
  required RequestDirection direction,
}) {
  final items = <RequestItem>[];

  for (final bill in bills) {
    final label = _billLabel(bill);

    if (direction == RequestDirection.owedToYou) {
      if (bill.payerId != currentUserId) continue;

      for (final share in bill.shares) {
        if (share.user.id == currentUserId || share.shareCents <= 0) {
          continue;
        }

        items.add(
          RequestItem(
            billId: bill.id,
            billLabel: label,
            incurredAt: bill.incurredAt,
            counterparty: share.user,
            amountCents: share.shareCents,
            payerMarkedAsPaid: share.payerMarkedAsPaid,
            lenderConfirmedPaid: share.lenderConfirmedPaid,
            direction: direction,
          ),
        );
      }
      continue;
    }

    if (bill.payerId == currentUserId) continue;

    BillShare? ownShare;
    for (final share in bill.shares) {
      if (share.user.id == currentUserId) {
        ownShare = share;
        break;
      }
    }

    if (ownShare == null || ownShare.shareCents <= 0) continue;

    items.add(
      RequestItem(
        billId: bill.id,
        billLabel: label,
        incurredAt: bill.incurredAt,
        counterparty: bill.payer,
        amountCents: ownShare.shareCents,
        payerMarkedAsPaid: ownShare.payerMarkedAsPaid,
        lenderConfirmedPaid: ownShare.lenderConfirmedPaid,
        direction: direction,
      ),
    );
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
