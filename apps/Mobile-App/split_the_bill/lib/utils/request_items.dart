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
  bool includePassedRequests = true,
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

  if (!includePassedRequests) {
    items.removeWhere((item) => item.lenderConfirmedPaid);
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

List<RequestItem> requestItemsForFriend({
  required List<Bill> bills,
  required String currentUserId,
  required String friendUserId,
  bool includePassedRequests = false,
}) {
  final items = [
    ...requestItemsFromBills(
      bills: bills,
      currentUserId: currentUserId,
      direction: RequestDirection.owedToYou,
      includePassedRequests: includePassedRequests,
    ),
    ...requestItemsFromBills(
      bills: bills,
      currentUserId: currentUserId,
      direction: RequestDirection.youOwe,
      includePassedRequests: includePassedRequests,
    ),
  ].where((item) => item.counterparty.id == friendUserId).toList();

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

int friendNetBalanceCents(List<RequestItem> items) {
  var balance = 0;
  for (final item in items) {
    if (item.lenderConfirmedPaid) continue;

    if (item.direction == RequestDirection.owedToYou) {
      balance += item.amountCents;
      continue;
    }

    // Match dashboard: pending "you owe" (debtor marked paid) does not count.
    if (item.payerMarkedAsPaid) continue;
    balance -= item.amountCents;
  }
  return balance;
}

/// Sum of "you owe" amounts the current user marked paid, awaiting lender confirm.
int friendAwaitingConfirmationCents(List<RequestItem> items) {
  var total = 0;
  for (final item in items) {
    if (item.direction != RequestDirection.youOwe) continue;
    if (!item.payerMarkedAsPaid || item.lenderConfirmedPaid) continue;
    total += item.amountCents;
  }
  return total;
}

class RequestDirectionTotals {
  const RequestDirectionTotals({
    required this.totalCents,
    required this.pendingConfirmationCents,
  });

  /// Open amount for the selected direction.
  ///
  /// Owed to you: all unconfirmed shares you are owed (includes pending).
  /// You owe: unpaid shares only (excludes shares you marked paid).
  final int totalCents;

  /// Amount waiting on confirmation in this direction.
  ///
  /// Owed to you: counterparty marked paid, awaiting your confirmation.
  /// You owe: you marked paid, awaiting lender confirmation.
  final int pendingConfirmationCents;

  bool get hasAnyAmount => totalCents > 0 || pendingConfirmationCents > 0;
}

RequestDirectionTotals requestDirectionTotalsFromBills({
  required List<Bill> bills,
  required String currentUserId,
  required RequestDirection direction,
}) {
  var totalCents = 0;
  var pendingConfirmationCents = 0;

  for (final bill in bills) {
    for (final share in bill.shares) {
      if (share.shareCents <= 0 || share.lenderConfirmedPaid) continue;

      if (direction == RequestDirection.owedToYou) {
        if (share.lenderId != currentUserId || share.user.id == currentUserId) {
          continue;
        }

        totalCents += share.shareCents;
        if (share.payerMarkedAsPaid) {
          pendingConfirmationCents += share.shareCents;
        }
        continue;
      }

      if (share.user.id != currentUserId || share.lenderId == currentUserId) {
        continue;
      }

      if (share.payerMarkedAsPaid) {
        pendingConfirmationCents += share.shareCents;
      } else {
        totalCents += share.shareCents;
      }
    }
  }

  return RequestDirectionTotals(
    totalCents: totalCents,
    pendingConfirmationCents: pendingConfirmationCents,
  );
}
