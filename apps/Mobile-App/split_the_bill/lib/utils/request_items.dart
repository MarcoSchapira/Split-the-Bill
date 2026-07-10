import 'package:flutter/material.dart';

import '../models/models.dart';
import '../models/user.dart';
import '../theme/app_colors.dart';

enum RequestDirection { owedToYou, youOwe }

class RequestItem {
  const RequestItem({
    required this.billId,
    required this.billLabel,
    required this.incurredAt,
    required this.counterparty,
    required this.amountCents,
    required this.settlementStatus,
    required this.direction,
  });

  final String billId;
  final String billLabel;
  final String incurredAt;
  final User counterparty;
  final int amountCents;
  final String settlementStatus;
  final RequestDirection direction;
}

int _settlementSortOrder(String status) {
  return switch (status) {
    'NOT_PAID' => 0,
    'PENDING' => 1,
    'PAID' => 2,
    _ => 0,
  };
}

String _billLabel(Bill bill) {
  final description = bill.description.trim();
  if (description.isNotEmpty) return description;

  final storeName = bill.storeName?.trim();
  if (storeName != null && storeName.isNotEmpty) return storeName;

  return 'Bill';
}

bool _isSharePaid(BillShare share) {
  return share.settlementStatus == 'PAID' || share.settledAt != null;
}

String _effectiveSettlementStatus(BillShare share) {
  if (_isSharePaid(share)) return 'PAID';
  return share.settlementStatus;
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
            settlementStatus: _effectiveSettlementStatus(share),
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
        settlementStatus: _effectiveSettlementStatus(ownShare),
        direction: direction,
      ),
    );
  }

  items.sort((left, right) {
    final statusCompare = _settlementSortOrder(
      left.settlementStatus,
    ).compareTo(_settlementSortOrder(right.settlementStatus));
    if (statusCompare != 0) return statusCompare;

    return right.incurredAt.compareTo(left.incurredAt);
  });

  return items;
}

double settlementProgress(String settlementStatus) {
  return switch (settlementStatus) {
    'PAID' => 1.0,
    'PENDING' => 0.5,
    _ => 0.0,
  };
}

String settlementStatusLabel(String settlementStatus) {
  return switch (settlementStatus) {
    'PAID' => 'Paid',
    'PENDING' => 'Pending',
    _ => 'Unpaid',
  };
}

Color settlementProgressColor({
  required String settlementStatus,
  required RequestDirection direction,
}) {
  return switch (settlementStatus) {
    'PAID' => AppColors.accent,
    'PENDING' => AppColors.pendingText,
    _ => direction == RequestDirection.owedToYou
        ? AppColors.brandSoft
        : AppColors.error,
  };
}
