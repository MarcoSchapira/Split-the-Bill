import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../api/api_exception.dart';
import '../../models/receipt.dart';
import '../../providers/providers.dart';
import '../../utils/capture_bill_split.dart';
import '../../utils/format.dart';
import '../../widgets/bill_flow/bill_flow_step_header.dart';
import '../../widgets/bill_flow/bill_flow_summary_card.dart';
import '../../widgets/common_widgets.dart';

class CaptureConfirmScreen extends ConsumerStatefulWidget {
  const CaptureConfirmScreen({super.key, required this.flow});

  final BillFlowState flow;

  @override
  ConsumerState<CaptureConfirmScreen> createState() => _CaptureConfirmScreenState();
}

class _CaptureConfirmScreenState extends ConsumerState<CaptureConfirmScreen> {
  final _descriptionController = TextEditingController();
  bool _saving = false;
  String? _error;
  late DateTime _incurredAt;

  BillFlowState get _flow => widget.flow;

  @override
  void initState() {
    super.initState();
    final receipt = _flow.receipt;
    _descriptionController.text =
        (_flow.description ?? receipt?.storeName ?? 'Receipt').trim().isNotEmpty
            ? (_flow.description ?? receipt?.storeName ?? 'Receipt').trim()
            : 'Receipt';
    _incurredAt = _flow.incurredAt ?? _parseReceiptDate(receipt) ?? DateTime.now();
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  CaptureShareResult get _shareResult {
    return computeCaptureShares(
      receipt: _flow.receipt!,
      items: _flow.receipt!.items,
      assignments: _flow.assignments,
      participantIds: _flow.participants.map((user) => user.id).toList(),
    );
  }

  DateTime? _parseReceiptDate(ParsedReceipt? receipt) {
    if (receipt == null || receipt.date == null) return null;
    final timePart = receipt.time != null ? ' ${receipt.time}' : '';
    return DateTime.tryParse('${receipt.date}$timePart');
  }

  String _incurredAtIso() {
    return DateTime.utc(
      _incurredAt.year,
      _incurredAt.month,
      _incurredAt.day,
    ).toIso8601String();
  }

  Map<String, dynamic> _buildBillInput({
    required ParsedReceipt receipt,
    required CaptureShareResult shareResult,
  }) {
    final participantIds = _flow.participants.map((user) => user.id).toList();
    return {
      'description': _descriptionController.text.trim().isEmpty
          ? 'Receipt'
          : _descriptionController.text.trim(),
      'incurredAt': _incurredAtIso(),
      'totalCents': shareResult.totalCents,
      'participantIds': participantIds,
      'payerId': _flow.payerId!,
      'source': 'capture',
      'storeName': receipt.storeName,
      'storeAddress': receipt.storeAddress,
      'receiptNumber': receipt.receiptNumber,
      'receiptDate': receipt.date,
      'receiptTime': receipt.time,
      'paymentMethod': receipt.paymentMethod,
      'cardLast4': receipt.cardLast4,
      'itemCount': receipt.itemCount,
      'subtotalCents': receipt.subtotal != null ? (receipt.subtotal! * 100).round() : null,
      'taxCents': receipt.tax != null ? (receipt.tax! * 100).round() : null,
      'tipCents': receipt.tip != null ? (receipt.tip! * 100).round() : null,
      'lineItems': receipt.items.asMap().entries.map((entry) {
        final assigned = _flow.assignments[entry.key] ?? const <String>{};
        return {
          'name': entry.value.name,
          'quantity': entry.value.quantity,
          'unitPriceCents': entry.value.unitPriceCents,
          'totalPriceCents': entry.value.totalPriceCents,
          'assignedUserIds': assigned.toList(),
        };
      }).toList(),
      'shares': shareResult.shares
          .map((share) => {
                'userId': share.userId,
                'shareCents': share.shareCents,
              })
          .toList(),
    };
  }

  Future<void> _confirm() async {
    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final receipt = _flow.receipt!;
      final shareResult = _shareResult;
      final input = _buildBillInput(receipt: receipt, shareResult: shareResult);
      if (_flow.isEditing) {
        await ref.read(billsApiProvider).updateBill(_flow.billId!, input);
      } else {
        await ref.read(billsApiProvider).createBill(input);
      }

      notifyDataChanged(ref);
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _flow.isEditing ? 'Bill updated successfully.' : 'Bill saved successfully.',
          ),
        ),
      );
      if (_flow.isEditing) {
        context.go('/bills/${_flow.billId}');
      } else {
        context.go('/dashboard');
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = apiErrorMessage(e, _flow.isEditing ? 'Unable to update bill.' : 'Unable to save bill.');
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final payer = _flow.participants.firstWhere(
      (user) => user.id == _flow.payerId,
      orElse: () => _flow.currentUser,
    );
    final payerName = displayName(payer);
    final shareResult = _shareResult;
    final shareByUser = {
      for (final share in shareResult.shares) share.userId: share.shareCents,
    };

    return Scaffold(
      appBar: AppBar(title: Text(_flow.isEditing ? 'Review changes' : 'Confirm split')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const BillFlowStepHeader(stepNumber: 3, totalSteps: 3, title: 'Review'),
          const SizedBox(height: 12),
          if (_error != null) ...[
            ErrorBanner(message: _error!),
            const SizedBox(height: 16),
          ],
          BillFlowSummaryCard(
            receipt: _flow.receipt!,
            payerName: payerName,
            incurredAt: _incurredAt,
            eyebrowText: _flow.isEditing ? 'Editing receipt' : 'Captured receipt',
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _descriptionController,
            maxLength: 120,
            decoration: const InputDecoration(labelText: 'Description'),
          ),
          const SizedBox(height: 8),
          InkWell(
            onTap: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: _incurredAt,
                firstDate: DateTime(2000),
                lastDate: DateTime(2100),
              );
              if (picked != null) {
                setState(() => _incurredAt = picked);
              }
            },
            child: InputDecorator(
              decoration: const InputDecoration(labelText: 'Date'),
              child: Text(formatDateUtc(_incurredAt.toUtc().toIso8601String())),
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'Settlement',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
          ),
          const SizedBox(height: 12),
          ..._flow.participants.map((participant) {
            final shareCents = shareByUser[participant.id] ?? 0;
            final isPayer = participant.id == _flow.payerId;
            final collectTotal = shareResult.shares
                .where((share) => share.userId != _flow.payerId)
                .fold<int>(0, (sum, share) => sum + share.shareCents);

            if (isPayer) {
              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  title: Text(
                    participant.id == _flow.currentUser.id ? 'You paid' : '$payerName paid',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  subtitle: Text("You'll collect ${formatCad(collectTotal)}"),
                  trailing: Text(
                    formatCad(shareResult.totalCents),
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              );
            }

            return Card(
              margin: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                title: Text(
                  '${displayName(participant)} owes $payerName',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                trailing: Text(
                  formatCad(shareCents),
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            );
          }),
        ],
      ),
      bottomNavigationBar: Padding(
        padding: const EdgeInsets.all(16),
        child: PrimaryButton(
          label: _flow.isEditing ? 'Save changes' : 'Confirm',
          isLoading: _saving,
          onPressed: _saving ? null : _confirm,
        ),
      ),
    );
  }
}
