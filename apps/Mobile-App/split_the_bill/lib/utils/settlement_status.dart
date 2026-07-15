import 'package:flutter/material.dart';

import '../models/models.dart';
import '../theme/app_colors.dart';
import 'request_items.dart';

enum BillSettlementState { unpaid, pending, settled }

bool isShareFullySettled(BillShare share) {
  return share.lenderConfirmedPaid;
}

BillSettlementState billSettlementState({
  required bool payerMarkedAsPaid,
  required bool lenderConfirmedPaid,
}) {
  if (lenderConfirmedPaid) return BillSettlementState.settled;
  if (payerMarkedAsPaid) return BillSettlementState.pending;
  return BillSettlementState.unpaid;
}

BillSettlementState billShareSettlementState(
  BillShare share, {
  required String payerId,
}) {
  if (share.user.id == payerId) return BillSettlementState.settled;
  return billSettlementState(
    payerMarkedAsPaid: share.payerMarkedAsPaid,
    lenderConfirmedPaid: share.lenderConfirmedPaid,
  );
}

String billSettlementStatusLabel(BillSettlementState state) {
  return switch (state) {
    BillSettlementState.settled => 'paid',
    BillSettlementState.pending => 'paid - pending',
    BillSettlementState.unpaid => 'not paid',
  };
}

Color billSettlementStatusColor(BillSettlementState state) {
  return switch (state) {
    BillSettlementState.settled => AppColors.accent,
    BillSettlementState.pending => AppColors.pendingText,
    BillSettlementState.unpaid => AppColors.error,
  };
}

Color billSettlementStatusBackground(BillSettlementState state) {
  return switch (state) {
    BillSettlementState.settled => AppColors.accentSoft,
    BillSettlementState.pending => AppColors.pendingBg,
    BillSettlementState.unpaid => AppColors.errorBg,
  };
}

List<BillShare> billDebtorShares(Bill bill) {
  return bill.shares.where((share) => share.user.id != bill.payerId).toList();
}

int billSettledDebtorCount(List<BillShare> debtorShares) {
  return debtorShares.where((share) => share.lenderConfirmedPaid).length;
}

int billPendingDebtorCount(List<BillShare> debtorShares) {
  return debtorShares
      .where(
        (share) => share.payerMarkedAsPaid && !share.lenderConfirmedPaid,
      )
      .length;
}

int billUnpaidDebtorCount(List<BillShare> debtorShares) {
  return debtorShares
      .where(
        (share) => !share.payerMarkedAsPaid && !share.lenderConfirmedPaid,
      )
      .length;
}

double billDebtorProgress(List<BillShare> debtorShares) {
  if (debtorShares.isEmpty) return 1.0;
  final total = debtorShares.fold<double>(
    0,
    (sum, share) =>
        sum +
        settlementProgress(
          payerMarkedAsPaid: share.payerMarkedAsPaid,
          lenderConfirmedPaid: share.lenderConfirmedPaid,
        ),
  );
  return total / debtorShares.length;
}

int billAmountStillOwedToPayer(List<BillShare> debtorShares) {
  return debtorShares
      .where((share) => !share.lenderConfirmedPaid)
      .fold<int>(0, (sum, share) => sum + share.shareCents);
}

bool billAllDebtorsSettled(List<BillShare> debtorShares) {
  if (debtorShares.isEmpty) return true;
  return debtorShares.every((share) => share.lenderConfirmedPaid);
}

String billPayerCollectingSubtitle({
  required int unpaidCount,
  required int pendingCount,
}) {
  final waitingParts = <String>[];
  if (unpaidCount > 0) {
    waitingParts.add(
      unpaidCount == 1
          ? 'Waiting on 1 person to pay you back'
          : 'Waiting on $unpaidCount people to pay you back',
    );
  }
  if (pendingCount > 0) {
    waitingParts.add(
      pendingCount == 1
          ? '1 payment pending your confirmation'
          : '$pendingCount payments pending your confirmation',
    );
  }
  if (waitingParts.isEmpty) {
    return 'Waiting on people to pay you back';
  }
  return waitingParts.join(' · ');
}

double settlementProgress({
  required bool payerMarkedAsPaid,
  required bool lenderConfirmedPaid,
}) {
  if (lenderConfirmedPaid) return 1.0;
  if (payerMarkedAsPaid) return 0.5;
  return 0.0;
}

Color settlementStatusColor({
  required bool payerMarkedAsPaid,
  required bool lenderConfirmedPaid,
}) {
  if (lenderConfirmedPaid) return AppColors.accent;
  if (payerMarkedAsPaid) return AppColors.pendingText;
  return AppColors.error;
}

String settlementStatusDetailLabel({
  required bool payerMarkedAsPaid,
  required bool lenderConfirmedPaid,
  required String counterpartyName,
  required RequestDirection direction,
}) {
  if (lenderConfirmedPaid) return 'Paid and confirmed';
  if (payerMarkedAsPaid) {
    return direction == RequestDirection.youOwe
        ? 'You marked as paid'
        : '$counterpartyName marked as paid';
  }
  return 'Not paid';
}

int settlementSortOrder({
  required bool payerMarkedAsPaid,
  required bool lenderConfirmedPaid,
}) {
  if (lenderConfirmedPaid) return 2;
  if (payerMarkedAsPaid) return 1;
  return 0;
}

double requestSettlementProgress({
  required bool payerMarkedAsPaid,
  required bool lenderConfirmedPaid,
}) {
  return settlementProgress(
    payerMarkedAsPaid: payerMarkedAsPaid,
    lenderConfirmedPaid: lenderConfirmedPaid,
  );
}

Color requestSettlementBarColor({
  required bool payerMarkedAsPaid,
  required bool lenderConfirmedPaid,
  required RequestRole role,
}) {
  if (lenderConfirmedPaid) return AppColors.accent;
  if (payerMarkedAsPaid) return AppColors.pendingText;
  return AppColors.surfaceMuted;
}

Color requestSettlementStatusColor({
  required bool payerMarkedAsPaid,
  required bool lenderConfirmedPaid,
  required RequestRole role,
}) {
  if (lenderConfirmedPaid) return AppColors.accent;
  if (payerMarkedAsPaid) return AppColors.pendingText;
  return AppColors.error;
}

String requestSettlementStatusLabel({
  required bool payerMarkedAsPaid,
  required bool lenderConfirmedPaid,
  required RequestRole role,
}) {
  if (lenderConfirmedPaid) {
    return role == RequestRole.debtor
        ? 'Lender marked as paid'
        : 'Paid and confirmed';
  }
  if (payerMarkedAsPaid) {
    return role == RequestRole.debtor
        ? 'pending lender confirmation'
        : 'Pending your confirmation';
  }
  return 'Not paid';
}

String requestMarkPaidActionLabel(RequestRole role) {
  return role == RequestRole.debtor ? 'Mark as paid' : 'Confirm paid';
}

bool canShowRequestMarkPaidAction({
  required bool payerMarkedAsPaid,
  required bool lenderConfirmedPaid,
  required RequestRole role,
}) {
  if (lenderConfirmedPaid) return false;
  if (role == RequestRole.debtor) return !payerMarkedAsPaid;
  return true;
}

bool showDebtorMarkedBadge({
  required bool payerMarkedAsPaid,
  required bool lenderConfirmedPaid,
  required RequestRole role,
}) {
  return role == RequestRole.debtor &&
      payerMarkedAsPaid &&
      !lenderConfirmedPaid;
}
