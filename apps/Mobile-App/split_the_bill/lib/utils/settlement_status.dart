import 'package:flutter/material.dart';

import '../models/models.dart';
import '../theme/app_colors.dart';
import 'request_items.dart';

bool isShareFullySettled(BillShare share) {
  return share.lenderConfirmedPaid;
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
  if (payerMarkedAsPaid) {
    return role == RequestRole.debtor
        ? AppColors.accent
        : AppColors.pendingText;
  }
  return AppColors.surfaceMuted;
}

Color requestSettlementStatusColor({
  required bool payerMarkedAsPaid,
  required bool lenderConfirmedPaid,
  required RequestRole role,
}) {
  if (lenderConfirmedPaid) return AppColors.accent;
  if (payerMarkedAsPaid) {
    return role == RequestRole.debtor
        ? AppColors.accent
        : AppColors.pendingText;
  }
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
