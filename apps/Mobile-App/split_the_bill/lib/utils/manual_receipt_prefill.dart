import '../models/models.dart';
import '../models/receipt.dart';
import '../models/user.dart';
import 'format.dart';

enum ManualReceiptAdjustmentMode { percent, amount }

enum ManualReceiptSplitMode { splitTotal, splitByLineItem }

class ManualReceiptLineItemSeed {
  const ManualReceiptLineItemSeed({
    required this.quantity,
    required this.title,
    required this.price,
    this.assignedUserIds = const {},
  });

  final String quantity;
  final String title;
  final String price;
  final Set<String> assignedUserIds;
}

class ManualReceiptSplitSeed {
  const ManualReceiptSplitSeed({
    required this.user,
    required this.shareCents,
  });

  final User user;
  final int shareCents;
}

class ManualReceiptPrefill {
  const ManualReceiptPrefill({
    this.title = '',
    this.amount = '',
    this.storeName = '',
    this.storeAddress = '',
    this.receiptNumber = '',
    this.receiptDate = '',
    this.receiptTime = '',
    this.paymentMethod = '',
    this.cardLast4 = '',
    this.taxValue = '13',
    this.tipValue = '0',
    this.taxInputMode = ManualReceiptAdjustmentMode.percent,
    this.tipInputMode = ManualReceiptAdjustmentMode.percent,
    this.payerId,
    this.selectedFriendIds = const {},
    this.splitEntries = const [],
    this.lineItemsEnabled = false,
    this.splitMode = ManualReceiptSplitMode.splitTotal,
    this.lineItems = const [],
    this.lineItemAssignments = const {},
    this.otherFeesCents = 0,
    this.incurredAt,
    this.billSource = BillSource.manual,
    this.expandAdditionalDetails = false,
  });

  final String title;
  final String amount;
  final String storeName;
  final String storeAddress;
  final String receiptNumber;
  final String receiptDate;
  final String receiptTime;
  final String paymentMethod;
  final String cardLast4;
  final String taxValue;
  final String tipValue;
  final ManualReceiptAdjustmentMode taxInputMode;
  final ManualReceiptAdjustmentMode tipInputMode;
  final String? payerId;
  final Set<String> selectedFriendIds;
  final List<ManualReceiptSplitSeed> splitEntries;
  final bool lineItemsEnabled;
  final ManualReceiptSplitMode splitMode;
  final List<ManualReceiptLineItemSeed> lineItems;
  final Map<int, Set<String>> lineItemAssignments;
  final int otherFeesCents;
  final DateTime? incurredAt;
  final BillSource billSource;
  final bool expandAdditionalDetails;
}

String formatManualReceiptQuantity(double quantity) {
  if (quantity == quantity.roundToDouble()) {
    return quantity.round().toString();
  }
  return quantity.toString();
}

DateTime? parseReceiptIncurredAt(ParsedReceipt receipt) {
  if (receipt.date == null) return null;
  final timePart = receipt.time != null ? ' ${receipt.time}' : '';
  return DateTime.tryParse('${receipt.date}$timePart');
}

String incurredAtIso(DateTime date) {
  return DateTime.utc(date.year, date.month, date.day).toIso8601String();
}

ManualReceiptPrefill prefillFromBill(Bill bill, User currentUser) {
  final selectedFriendIds = bill.shares
      .map((share) => share.user.id)
      .where((id) => id != currentUser.id)
      .toSet();
  final splitEntries = bill.shares
      .where((share) => share.user.id != bill.payerId)
      .map(
        (share) => ManualReceiptSplitSeed(
          user: share.user,
          shareCents: share.shareCents,
        ),
      )
      .toList()
    ..sort((a, b) => displayName(a.user).compareTo(displayName(b.user)));

  var lineItemsEnabled = false;
  var splitMode = ManualReceiptSplitMode.splitTotal;
  var lineItems = <ManualReceiptLineItemSeed>[];
  var lineItemAssignments = <int, Set<String>>{};
  var taxValue = '13';
  var tipValue = '0';
  var taxInputMode = ManualReceiptAdjustmentMode.percent;
  var tipInputMode = ManualReceiptAdjustmentMode.percent;

  if (bill.lineItems.isNotEmpty && !bill.isOneMainTotal) {
    lineItemsEnabled = true;
    splitMode = bill.isSplitByFinalAmounts
        ? ManualReceiptSplitMode.splitTotal
        : ManualReceiptSplitMode.splitByLineItem;
    final sortedItems = [...bill.lineItems]
      ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    lineItems = sortedItems
        .map(
          (item) => ManualReceiptLineItemSeed(
            quantity: formatManualReceiptQuantity(item.quantity),
            title: item.name,
            price: (item.unitPriceCents / 100).toStringAsFixed(2),
            assignedUserIds: item.assignments
                .map((assignment) => assignment.user.id)
                .toSet(),
          ),
        )
        .toList();
    lineItemAssignments = {
      for (final entry in sortedItems.asMap().entries)
        entry.key: entry.value.assignments
            .map((assignment) => assignment.user.id)
            .toSet(),
    };

    final taxAndTip = taxAndTipFromBillCents(
      taxCents: bill.taxCents,
      tipCents: bill.tipCents,
    );
    taxValue = taxAndTip.taxValue;
    tipValue = taxAndTip.tipValue;
    taxInputMode = taxAndTip.taxInputMode;
    tipInputMode = taxAndTip.tipInputMode;
  }

  final hasAdditionalDetails = [
    bill.storeName,
    bill.storeAddress,
    bill.receiptNumber,
    bill.receiptDate,
    bill.receiptTime,
    bill.paymentMethod,
    bill.cardLast4,
  ].any((value) => (value ?? '').trim().isNotEmpty);

  return ManualReceiptPrefill(
    title: bill.description,
    amount: (bill.totalCents / 100).toStringAsFixed(2),
    storeName: bill.storeName ?? '',
    storeAddress: bill.storeAddress ?? '',
    receiptNumber: bill.receiptNumber ?? '',
    receiptDate: bill.receiptDate ?? '',
    receiptTime: bill.receiptTime ?? '',
    paymentMethod: bill.paymentMethod ?? '',
    cardLast4: bill.cardLast4 ?? '',
    taxValue: taxValue,
    tipValue: tipValue,
    taxInputMode: taxInputMode,
    tipInputMode: tipInputMode,
    payerId: bill.payerId,
    selectedFriendIds: selectedFriendIds,
    splitEntries: splitEntries,
    lineItemsEnabled: lineItemsEnabled,
    splitMode: splitMode,
    lineItems: lineItems,
    lineItemAssignments: lineItemAssignments,
    otherFeesCents: bill.otherFeesCents ?? 0,
    incurredAt: DateTime.tryParse(bill.incurredAt),
    billSource: bill.source,
    expandAdditionalDetails: hasAdditionalDetails,
  );
}

ManualReceiptPrefill prefillFromParsedReceipt(ParsedReceipt receipt) {
  final hasItems = receipt.items.isNotEmpty;
  final lineItems = hasItems
      ? receipt.items
            .map(
              (item) => ManualReceiptLineItemSeed(
                quantity: formatManualReceiptQuantity(item.quantity.toDouble()),
                title: item.name,
                price: item.unitPrice.toStringAsFixed(2),
              ),
            )
            .toList()
      : <ManualReceiptLineItemSeed>[];

  final taxAndTip = taxAndTipFromReceiptDollars(
    tax: receipt.tax,
    tip: receipt.tip,
  );

  final title = (receipt.storeName ?? '').trim().isNotEmpty
      ? receipt.storeName!.trim()
      : 'Receipt';
  final amount = receipt.total != null
      ? receipt.total!.toStringAsFixed(2)
      : '';

  final hasAdditionalDetails = [
    receipt.storeName,
    receipt.storeAddress,
    receipt.receiptNumber,
    receipt.date,
    receipt.time,
    receipt.paymentMethod,
    receipt.cardLast4,
  ].any((value) => (value ?? '').trim().isNotEmpty);

  return ManualReceiptPrefill(
    title: title,
    amount: amount,
    storeName: receipt.storeName ?? '',
    storeAddress: receipt.storeAddress ?? '',
    receiptNumber: receipt.receiptNumber ?? '',
    receiptDate: receipt.date ?? '',
    receiptTime: receipt.time ?? '',
    paymentMethod: receipt.paymentMethod ?? '',
    cardLast4: receipt.cardLast4 ?? '',
    taxValue: taxAndTip.taxValue,
    tipValue: taxAndTip.tipValue,
    taxInputMode: taxAndTip.taxInputMode,
    tipInputMode: taxAndTip.tipInputMode,
    lineItemsEnabled: hasItems,
    lineItems: lineItems,
    otherFeesCents: receipt.otherFees != null
        ? (receipt.otherFees! * 100).round()
        : 0,
    incurredAt: parseReceiptIncurredAt(receipt) ?? DateTime.now(),
    billSource: BillSource.capture,
    expandAdditionalDetails: hasAdditionalDetails,
  );
}

({
  String taxValue,
  String tipValue,
  ManualReceiptAdjustmentMode taxInputMode,
  ManualReceiptAdjustmentMode tipInputMode,
}) taxAndTipFromBillCents({
  required int? taxCents,
  required int? tipCents,
}) {
  // Stored bill tax/tip are always currency amounts (cents), never rates.
  var taxValue = '0.00';
  var tipValue = '0.00';
  const taxInputMode = ManualReceiptAdjustmentMode.amount;
  const tipInputMode = ManualReceiptAdjustmentMode.amount;

  if (taxCents != null) {
    taxValue = (taxCents / 100).toStringAsFixed(2);
  }

  if (tipCents != null) {
    tipValue = (tipCents / 100).toStringAsFixed(2);
  }

  return (
    taxValue: taxValue,
    tipValue: tipValue,
    taxInputMode: taxInputMode,
    tipInputMode: tipInputMode,
  );
}

({
  String taxValue,
  String tipValue,
  ManualReceiptAdjustmentMode taxInputMode,
  ManualReceiptAdjustmentMode tipInputMode,
}) taxAndTipFromReceiptDollars({
  required double? tax,
  required double? tip,
}) {
  // OCR returns tax/tip/other_fees as currency amounts, never percentages.
  var taxValue = '0.00';
  var tipValue = '0.00';
  const taxInputMode = ManualReceiptAdjustmentMode.amount;
  const tipInputMode = ManualReceiptAdjustmentMode.amount;

  if (tax != null) {
    taxValue = tax.toStringAsFixed(2);
  }

  if (tip != null) {
    tipValue = tip.toStringAsFixed(2);
  }

  return (
    taxValue: taxValue,
    tipValue: tipValue,
    taxInputMode: taxInputMode,
    tipInputMode: tipInputMode,
  );
}
