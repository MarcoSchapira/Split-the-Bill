import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../api/api_exception.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../../widgets/bill_list/bill_list.dart';
import '../../widgets/common_widgets.dart';

class BillsScreen extends ConsumerStatefulWidget {
  const BillsScreen({super.key});

  @override
  ConsumerState<BillsScreen> createState() => _BillsScreenState();
}

class _BillsScreenState extends ConsumerState<BillsScreen> {
  List<Bill> _bills = [];
  String? _error;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _error = null;
      _isLoading = true;
    });

    try {
      final bills = await ref.read(billsApiProvider).listBills();
      if (mounted) setState(() => _bills = bills);
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Unable to load bills.'));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(dataRefreshProvider, (_, __) => _load());

    if (_isLoading && _bills.isEmpty) {
      return const LoadingView(message: 'Loading bills...');
    }

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.accent,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Bills', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          const Text('All recorded bills and captured receipts.'),
          const SizedBox(height: 16),
          if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
          BillList(bills: _bills, onChanged: _load),
        ],
      ),
    );
  }
}

class BillDetailScreen extends ConsumerStatefulWidget {
  const BillDetailScreen({super.key, required this.billId});

  final String billId;

  @override
  ConsumerState<BillDetailScreen> createState() => _BillDetailScreenState();
}

class _BillDetailScreenState extends ConsumerState<BillDetailScreen> {
  Bill? _bill;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final bill = await ref.read(billsApiProvider).getBill(widget.billId);
      if (mounted) setState(() => _bill = bill);
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Unable to load bill details.'));
    }
  }

  String _formatQuantity(double quantity) {
    if (quantity == quantity.roundToDouble()) {
      return quantity.toInt().toString();
    }
    return quantity.toStringAsFixed(3).replaceFirst(RegExp(r'0+$'), '').replaceFirst(RegExp(r'\.$'), '');
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(dataRefreshProvider, (_, __) => _load());
    final bill = _bill;

    return Scaffold(
      appBar: AppBar(title: Text(bill?.description ?? 'Bill')),
      body: bill == null
          ? (_error != null
              ? Center(child: Text(_error!))
              : const LoadingView(message: 'Loading bill...'))
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.accent,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Eyebrow(bill.source == BillSource.capture ? 'Captured receipt' : 'Manual bill'),
                  const SizedBox(height: 4),
                  Text(formatDateUtc(bill.incurredAt), style: const TextStyle(color: AppColors.text)),
                  const SizedBox(height: 12),
                  Text('Total ${formatCad(bill.totalCents)}', style: const TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 16),
                  if (bill.storeName != null || bill.paymentMethod != null) ...[
                    const Text('Receipt details', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    if (bill.storeName != null) Text('Store: ${bill.storeName}'),
                    if (bill.storeAddress != null) Text('Address: ${bill.storeAddress}'),
                    if (bill.receiptNumber != null) Text('Receipt #: ${bill.receiptNumber}'),
                    if (bill.receiptDate != null) Text('Date: ${bill.receiptDate}'),
                    if (bill.receiptTime != null) Text('Time: ${bill.receiptTime}'),
                    if (bill.paymentMethod != null)
                      Text('Payment: ${bill.paymentMethod}${bill.cardLast4 != null ? ' •••• ${bill.cardLast4}' : ''}'),
                    const SizedBox(height: 16),
                  ],
                  if (bill.lineItems.isNotEmpty) ...[
                    Row(
                      children: [
                        const Text('Items', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                        const Spacer(),
                        CountBadge(count: bill.lineItems.length),
                      ],
                    ),
                    const SizedBox(height: 8),
                    ...bill.lineItems.map((item) => Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            title: Text(item.name),
                            subtitle: Text(
                              '${_formatQuantity(item.quantity)} × ${formatCad(item.unitPriceCents)}\nAssigned to ${item.assignments.map((a) => displayName(a.user)).join(', ')}',
                            ),
                            isThreeLine: true,
                            trailing: Text(formatCad(item.totalPriceCents)),
                          ),
                        )),
                    const SizedBox(height: 16),
                  ],
                  const Text('Split', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  ...bill.shares.map((share) => Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          title: Text(displayName(share.user)),
                          trailing: Text(formatCad(share.shareCents)),
                        ),
                      )),
                  const SizedBox(height: 8),
                  Text(
                    'Subtotal ${formatCad(bill.subtotalCents ?? 0)} • Tax ${formatCad(bill.taxCents ?? 0)} • Tip ${formatCad(bill.tipCents ?? 0)}',
                    style: const TextStyle(color: AppColors.text),
                  ),
                ],
              ),
            ),
    );
  }
}
