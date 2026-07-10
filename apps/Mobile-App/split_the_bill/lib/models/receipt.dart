class ReceiptItem {
  const ReceiptItem({
    required this.name,
    required this.quantity,
    required this.unitPrice,
    required this.totalPrice,
  });

  final String name;
  final int quantity;
  final double unitPrice;
  final double totalPrice;

  factory ReceiptItem.fromJson(Map<String, dynamic> json) {
    return ReceiptItem(
      name: json['name'] as String,
      quantity: (json['quantity'] as num).toInt(),
      unitPrice: (json['unit_price'] as num).toDouble(),
      totalPrice: (json['total_price'] as num).toDouble(),
    );
  }

  Map<String, dynamic> toJson() => {
        'name': name,
        'quantity': quantity,
        'unit_price': unitPrice,
        'total_price': totalPrice,
      };

  int get totalPriceCents => (totalPrice * 100).round();
  int get unitPriceCents => (unitPrice * 100).round();
}

class ParsedReceipt {
  const ParsedReceipt({
    required this.storeName,
    required this.storeAddress,
    required this.receiptNumber,
    required this.date,
    required this.time,
    required this.items,
    required this.itemCount,
    required this.subtotal,
    required this.otherFees,
    required this.tax,
    required this.tip,
    required this.total,
    required this.paymentMethod,
    required this.cardLast4,
  });

  final String? storeName;
  final String? storeAddress;
  final String? receiptNumber;
  final String? date;
  final String? time;
  final List<ReceiptItem> items;
  final int? itemCount;
  final double? subtotal;
  final double? otherFees;
  final double? tax;
  final double? tip;
  final double? total;
  final String? paymentMethod;
  final String? cardLast4;

  factory ParsedReceipt.fromJson(Map<String, dynamic> json) {
    return ParsedReceipt(
      storeName: json['store_name'] as String?,
      storeAddress: json['store_address'] as String?,
      receiptNumber: json['receipt_number'] as String?,
      date: json['date'] as String?,
      time: json['time'] as String?,
      items: (json['items'] as List<dynamic>? ?? [])
          .map((e) => ReceiptItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      itemCount: (json['item_count'] as num?)?.toInt(),
      subtotal: (json['subtotal'] as num?)?.toDouble(),
      otherFees: (json['other_fees'] as num?)?.toDouble(),
      tax: (json['tax'] as num?)?.toDouble(),
      tip: (json['tip'] as num?)?.toDouble(),
      total: (json['total'] as num?)?.toDouble(),
      paymentMethod: json['payment_method'] as String?,
      cardLast4: json['card_last_4'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'store_name': storeName,
        'store_address': storeAddress,
        'receipt_number': receiptNumber,
        'date': date,
        'time': time,
        'items': items.map((item) => item.toJson()).toList(),
        'item_count': itemCount,
        'subtotal': subtotal,
        'other_fees': otherFees,
        'tax': tax,
        'tip': tip,
        'total': total,
        'payment_method': paymentMethod,
        'card_last_4': cardLast4,
      };
}
