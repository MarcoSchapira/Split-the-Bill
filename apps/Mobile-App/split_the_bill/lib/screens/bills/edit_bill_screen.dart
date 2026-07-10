import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../api/api_exception.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../capture/manual_receipt_screen.dart';

class EditBillScreen extends ConsumerStatefulWidget {
  const EditBillScreen({super.key, required this.billId});

  final String billId;

  @override
  ConsumerState<EditBillScreen> createState() => _EditBillScreenState();
}

class _EditBillScreenState extends ConsumerState<EditBillScreen> {
  Bill? _bill;
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

      if (!mounted) return;
      setState(() {
        _bill = bill;
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
    final bill = _bill;
    if (_loading || bill == null) {
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

    return ManualReceiptScreen(initialBill: bill);
  }
}
