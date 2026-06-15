import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../models/receipt.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../utils/capture_bill_split.dart';
import '../../utils/format.dart';
import '../../widgets/common_widgets.dart';

class CaptureConfirmScreen extends ConsumerStatefulWidget {
  const CaptureConfirmScreen({super.key, required this.flow});

  final CaptureFlowState flow;

  @override
  ConsumerState<CaptureConfirmScreen> createState() => _CaptureConfirmScreenState();
}

class _CaptureConfirmScreenState extends ConsumerState<CaptureConfirmScreen> {
  bool _saving = false;
  String? _error;

  CaptureFlowState get _flow => widget.flow;

  CaptureShareResult get _shareResult {
    return computeCaptureShares(
      receipt: _flow.receipt!,
      items: _flow.receipt!.items,
      assignments: _flow.assignments,
      participantIds: _flow.participants.map((user) => user.id).toList(),
    );
  }

  Future<void> _confirm() async {
    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final receipt = _flow.receipt!;
      final items = receipt.items
          .asMap()
          .entries
          .map(
            (entry) => CaptureBillItemPayload(
              name: entry.value.name,
              quantity: entry.value.quantity,
              unitPriceCents: entry.value.unitPriceCents,
              totalPriceCents: entry.value.totalPriceCents,
              assignedUserIds: (_flow.assignments[entry.key] ?? {}).toList(),
            ),
          )
          .toList();

      await ref.read(billsApiProvider).createCaptureBill(
            CaptureBillPayload(
              receipt: receipt,
              payerId: _flow.payerId!,
              participantIds: _flow.participants.map((user) => user.id).toList(),
              items: items,
            ),
          );

      notifyDataChanged(ref);
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bill saved successfully.')),
      );
      context.go('/dashboard');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
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
      appBar: AppBar(title: const Text('Confirm split')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_error != null) ...[
            ErrorBanner(message: _error!),
            const SizedBox(height: 16),
          ],
          Text(
            _flow.receipt?.storeName ?? 'Receipt',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Total ${formatCad(shareResult.totalCents)}',
            style: const TextStyle(color: AppColors.text),
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
          label: 'Confirm',
          isLoading: _saving,
          onPressed: _saving ? null : _confirm,
        ),
      ),
    );
  }
}
