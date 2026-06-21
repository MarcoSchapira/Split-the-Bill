import '../models/models.dart';
import '../models/receipt.dart';
import '../models/user.dart';
import 'format.dart';

class BillFlowBuildError implements Exception {
  const BillFlowBuildError(this.message);

  final String message;

  @override
  String toString() => message;
}

BillFlowState billFlowFromBill({
  required Bill bill,
  required User currentUser,
}) {
  if (bill.lineItems.isEmpty) {
    throw const BillFlowBuildError("This bill can't be edited in the new flow.");
  }

  final sortedItems = [...bill.lineItems]..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));

  final receiptItems = sortedItems
      .map(
        (item) => ReceiptItem(
          name: item.name,
          quantity: item.quantity.round(),
          unitPrice: item.unitPriceCents / 100,
          totalPrice: item.totalPriceCents / 100,
        ),
      )
      .toList();

  final assignments = <int, Set<String>>{};
  for (var i = 0; i < sortedItems.length; i++) {
    assignments[i] = sortedItems[i].assignments.map((a) => a.user.id).toSet();
  }

  final participants = bill.shares.map((share) => share.user).toList()
    ..sort((a, b) => displayName(a).toLowerCase().compareTo(displayName(b).toLowerCase()));

  final receipt = ParsedReceipt(
    storeName: bill.storeName,
    storeAddress: bill.storeAddress,
    receiptNumber: bill.receiptNumber,
    date: bill.receiptDate,
    time: bill.receiptTime,
    items: receiptItems,
    itemCount: bill.itemCount ?? receiptItems.length,
    subtotal: bill.subtotalCents != null ? bill.subtotalCents! / 100 : null,
    tax: bill.taxCents != null ? bill.taxCents! / 100 : null,
    tip: bill.tipCents != null ? bill.tipCents! / 100 : null,
    total: bill.totalCents / 100,
    paymentMethod: bill.paymentMethod,
    cardLast4: bill.cardLast4,
  );

  return BillFlowState(
    billId: bill.id,
    currentUser: currentUser,
    receipt: receipt,
    participants: participants,
    payerId: bill.payerId,
    assignments: assignments,
    description: bill.description,
    incurredAt: DateTime.tryParse(bill.incurredAt),
  );
}
