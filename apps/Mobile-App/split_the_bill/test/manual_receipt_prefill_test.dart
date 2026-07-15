import 'package:flutter_test/flutter_test.dart';
import 'package:equisplit/models/models.dart';
import 'package:equisplit/models/receipt.dart';
import 'package:equisplit/models/user.dart';
import 'package:equisplit/utils/manual_receipt_prefill.dart';

void main() {
  const currentUser = User(
    id: 'u1',
    email: 'a@b.com',
    name: 'Alice',
    createdAt: '2026-06-11T00:00:00.000Z',
  );

  test('prefillFromParsedReceipt uses line items when OCR returns items', () {
    const receipt = ParsedReceipt(
      storeName: 'Cafe Roma',
      storeAddress: '123 Main St',
      receiptNumber: 'A-12',
      date: '2026-06-11',
      time: '18:30',
      items: [
        ReceiptItem(
          name: 'Latte',
          quantity: 2,
          unitPrice: 4.5,
          totalPrice: 9,
        ),
        ReceiptItem(
          name: 'Muffin',
          quantity: 1,
          unitPrice: 3,
          totalPrice: 3,
        ),
      ],
      itemCount: 2,
      subtotal: 12,
      otherFees: 1,
      tax: 1.5,
      tip: 2,
      total: 16.5,
      paymentMethod: 'Card',
      cardLast4: '4242',
    );

    final prefill = prefillFromParsedReceipt(receipt);

    expect(prefill.title, 'Cafe Roma');
    expect(prefill.lineItemsEnabled, isTrue);
    expect(prefill.lineItems, hasLength(2));
    expect(prefill.lineItems.first.title, 'Latte');
    expect(prefill.lineItems.first.quantity, '2');
    expect(prefill.lineItems.first.price, '4.50');
    expect(prefill.taxValue, '1.50');
    expect(prefill.tipValue, '2.00');
    expect(prefill.taxInputMode, ManualReceiptAdjustmentMode.amount);
    expect(prefill.tipInputMode, ManualReceiptAdjustmentMode.amount);
    expect(prefill.otherFeesCents, 100);
    expect(prefill.billSource, BillSource.capture);
    expect(prefill.expandAdditionalDetails, isTrue);
    expect(prefill.incurredAt, isNotNull);
  });

  test('prefillFromParsedReceipt uses one main total when OCR has no items', () {
    const receipt = ParsedReceipt(
      storeName: null,
      storeAddress: null,
      receiptNumber: null,
      date: null,
      time: null,
      items: [],
      itemCount: 0,
      subtotal: null,
      otherFees: null,
      tax: null,
      tip: null,
      total: 42.5,
      paymentMethod: null,
      cardLast4: null,
    );

    final prefill = prefillFromParsedReceipt(receipt);

    expect(prefill.title, 'Receipt');
    expect(prefill.lineItemsEnabled, isFalse);
    expect(prefill.amount, '42.50');
    expect(prefill.taxValue, '0.00');
    expect(prefill.tipValue, '0.00');
    expect(prefill.taxInputMode, ManualReceiptAdjustmentMode.amount);
    expect(prefill.tipInputMode, ManualReceiptAdjustmentMode.amount);
    expect(prefill.billSource, BillSource.capture);
  });

  test('prefillFromParsedReceipt treats zero tax/tip as dollar amounts', () {
    const receipt = ParsedReceipt(
      storeName: 'Shop',
      storeAddress: null,
      receiptNumber: null,
      date: null,
      time: null,
      items: [
        ReceiptItem(
          name: 'Item',
          quantity: 1,
          unitPrice: 10,
          totalPrice: 10,
        ),
      ],
      itemCount: 1,
      subtotal: 10,
      otherFees: 0,
      tax: 0,
      tip: 0,
      total: 10,
      paymentMethod: null,
      cardLast4: null,
    );

    final prefill = prefillFromParsedReceipt(receipt);

    expect(prefill.taxValue, '0.00');
    expect(prefill.tipValue, '0.00');
    expect(prefill.taxInputMode, ManualReceiptAdjustmentMode.amount);
    expect(prefill.tipInputMode, ManualReceiptAdjustmentMode.amount);
    expect(prefill.otherFeesCents, 0);
  });

  test('taxAndTipFromBillCents uses dollar amounts not percentages', () {
    final result = taxAndTipFromBillCents(taxCents: 150, tipCents: 200);

    expect(result.taxValue, '1.50');
    expect(result.tipValue, '2.00');
    expect(result.taxInputMode, ManualReceiptAdjustmentMode.amount);
    expect(result.tipInputMode, ManualReceiptAdjustmentMode.amount);
  });

  test('prefillFromBill preserves capture bill line items and assignments', () {
    final bill = Bill.fromJson({
      'id': 'b1',
      'description': 'Dinner',
      'incurredAt': '2026-06-11T00:00:00.000Z',
      'totalCents': 4200,
      'subtotalCents': 3700,
      'taxCents': 300,
      'tipCents': 200,
      'otherFeesCents': 0,
      'source': 'capture',
      'payerId': 'u1',
      'creatorId': 'u1',
      'createdAt': '2026-06-11T00:00:00.000Z',
      'lastEditedAt': '2026-06-11T00:00:00.000Z',
      'isOneMainTotal': false,
      'isSplitWithFriends': true,
      'isSplitByFinalAmounts': false,
      'payer': {
        'id': 'u1',
        'email': 'a@b.com',
        'name': 'Alice',
        'createdAt': '2026-06-11T00:00:00.000Z',
      },
      'creator': {
        'id': 'u1',
        'email': 'a@b.com',
        'name': 'Alice',
        'createdAt': '2026-06-11T00:00:00.000Z',
      },
      'shares': [
        {
          'id': 's1',
          'shareCents': 2100,
          'lenderId': 'u1',
          'payerMarkedAsPaid': false,
          'lenderConfirmedPaid': false,
          'user': {
            'id': 'u1',
            'email': 'a@b.com',
            'name': 'Alice',
            'createdAt': '2026-06-11T00:00:00.000Z',
          },
        },
        {
          'id': 's2',
          'shareCents': 2100,
          'lenderId': 'u1',
          'payerMarkedAsPaid': false,
          'lenderConfirmedPaid': false,
          'user': {
            'id': 'u2',
            'email': 'b@c.com',
            'name': 'Bob',
            'createdAt': '2026-06-11T00:00:00.000Z',
          },
        },
      ],
      'userSummary': {'amountCents': 0, 'direction': 'none', 'settled': false},
      'lineItems': [
        {
          'id': 'li1',
          'name': 'Pasta',
          'quantity': 1,
          'unitPriceCents': 2000,
          'totalPriceCents': 2000,
          'sortOrder': 0,
          'assignments': [
            {
              'id': 'a1',
              'user': {
                'id': 'u1',
                'email': 'a@b.com',
                'name': 'Alice',
                'createdAt': '2026-06-11T00:00:00.000Z',
              },
            },
          ],
        },
        {
          'id': 'li2',
          'name': 'Salad',
          'quantity': 1,
          'unitPriceCents': 2200,
          'totalPriceCents': 2200,
          'sortOrder': 1,
          'assignments': [
            {
              'id': 'a2',
              'user': {
                'id': 'u2',
                'email': 'b@c.com',
                'name': 'Bob',
                'createdAt': '2026-06-11T00:00:00.000Z',
              },
            },
          ],
        },
      ],
      'canEdit': true,
      'canDelete': true,
      'canRetarget': false,
    });

    final prefill = prefillFromBill(bill, currentUser);

    expect(prefill.title, 'Dinner');
    expect(prefill.billSource, BillSource.capture);
    expect(prefill.lineItemsEnabled, isTrue);
    expect(prefill.splitMode, ManualReceiptSplitMode.splitByLineItem);
    expect(prefill.lineItems, hasLength(2));
    expect(prefill.lineItemAssignments[0], {'u1'});
    expect(prefill.lineItemAssignments[1], {'u2'});
    expect(prefill.selectedFriendIds, {'u2'});
    expect(prefill.taxValue, '3.00');
    expect(prefill.tipValue, '2.00');
    expect(prefill.taxInputMode, ManualReceiptAdjustmentMode.amount);
    expect(prefill.tipInputMode, ManualReceiptAdjustmentMode.amount);
  });

  test('prefillFromBill handles simple manual bill without line items', () {
    final bill = Bill.fromJson({
      'id': 'b1',
      'description': 'Coffee',
      'incurredAt': '2026-06-11T00:00:00.000Z',
      'totalCents': 500,
      'source': 'manual',
      'payerId': 'u1',
      'creatorId': 'u1',
      'createdAt': '2026-06-11T00:00:00.000Z',
      'lastEditedAt': '2026-06-11T00:00:00.000Z',
      'payer': {
        'id': 'u1',
        'email': 'a@b.com',
        'name': 'Alice',
        'createdAt': '2026-06-11T00:00:00.000Z',
      },
      'creator': {
        'id': 'u1',
        'email': 'a@b.com',
        'name': 'Alice',
        'createdAt': '2026-06-11T00:00:00.000Z',
      },
      'shares': [
        {
          'id': 's1',
          'shareCents': 500,
          'lenderId': 'u1',
          'payerMarkedAsPaid': false,
          'lenderConfirmedPaid': false,
          'user': {
            'id': 'u1',
            'email': 'a@b.com',
            'name': 'Alice',
            'createdAt': '2026-06-11T00:00:00.000Z',
          },
        },
      ],
      'userSummary': {'amountCents': 0, 'direction': 'none', 'settled': false},
      'lineItems': [],
      'canEdit': true,
      'canDelete': true,
      'canRetarget': false,
    });

    final prefill = prefillFromBill(bill, currentUser);

    expect(prefill.amount, '5.00');
    expect(prefill.lineItemsEnabled, isFalse);
    expect(prefill.billSource, BillSource.manual);
    expect(prefill.selectedFriendIds, isEmpty);
  });
}
