import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../api/api_exception.dart';
import '../../models/models.dart';
import '../../models/receipt.dart';
import '../../providers/providers.dart';
import '../../utils/bill_flow_from_bill.dart';
import '../capture/capture_participants_screen.dart';
import '../capture/manual_receipt_screen.dart';

class EditBillScreen extends ConsumerStatefulWidget {
  const EditBillScreen({super.key, required this.billId});

  final String billId;

  @override
  ConsumerState<EditBillScreen> createState() => _EditBillScreenState();
}

class _EditBillScreenState extends ConsumerState<EditBillScreen> {
  BillFlowState? _flow;
  Bill? _manualBill;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final user = ref.read(authProvider).user;
      if (user == null) {
        throw Exception('You must be signed in to edit a bill.');
      }

      final bill = await ref.read(billsApiProvider).getBill(widget.billId);
      if (!bill.canEdit) {
        throw Exception('You do not have permission to edit this bill.');
      }

      if (bill.lineItems.isEmpty) {
        if (!mounted) return;
        setState(() {
          _manualBill = bill;
          _loading = false;
        });
        return;
      }

      final flow = billFlowFromBill(bill: bill, currentUser: user);
      if (!mounted) return;
      setState(() {
        _flow = flow;
        _loading = false;
      });
    } on BillFlowBuildError catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = apiErrorMessage(e, 'Unable to open bill editor.');
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final flow = _flow;
    final manualBill = _manualBill;
    if (_loading || (flow == null && manualBill == null)) {
      return Scaffold(
        appBar: AppBar(title: const Text('Edit bill')),
        body: Center(
          child: _error != null
              ? Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!, textAlign: TextAlign.center),
                      const SizedBox(height: 12),
                      FilledButton(onPressed: _load, child: const Text('Retry')),
                    ],
                  ),
                )
              : const CircularProgressIndicator(),
        ),
      );
    }
    if (manualBill != null) {
      return ManualReceiptScreen(initialBill: manualBill);
    }
    return CaptureParticipantsScreen(flow: flow!);
  }
}
