import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../api/api_exception.dart';
import '../../models/receipt.dart';
import '../../models/user.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../../widgets/bill_flow/bill_flow_step_header.dart';
import '../../widgets/bill_flow/bill_flow_summary_card.dart';
import '../../widgets/common_widgets.dart';

class CaptureParticipantsScreen extends ConsumerStatefulWidget {
  const CaptureParticipantsScreen({super.key, required this.flow});

  final BillFlowState flow;

  @override
  ConsumerState<CaptureParticipantsScreen> createState() =>
      _CaptureParticipantsScreenState();
}

class _CaptureParticipantsScreenState extends ConsumerState<CaptureParticipantsScreen> {
  late BillFlowState _flow;
  List<CaptureSelectableContact> _contacts = [];
  final Set<String> _selectedIds = {};
  String? _payerId;
  bool _loadingContacts = true;
  bool _parsing = true;
  String? _contactsError;

  @override
  void initState() {
    super.initState();
    _flow = widget.flow;
    _payerId = widget.flow.payerId ?? widget.flow.currentUser.id;
    _parsing = !_flow.isEditing;
    _loadContacts();
    if (_flow.isEditing) return;
    _parseReceipt();
  }

  Future<void> _parseReceipt() async {
    setState(() {
      _parsing = true;
      _flow = _flow.copyWith(clearParseError: true);
    });

    try {
      final receipt = await ref.read(receiptsApiProvider).parseReceipt(
            Uint8List.fromList(_flow.imageBytes!),
            'receipt.jpg',
          );
      if (!mounted) return;
      setState(() {
        _flow = _flow.copyWith(receipt: receipt, clearParseError: true);
        _parsing = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _flow = _flow.copyWith(parseError: apiErrorMessage(e, 'Unable to parse receipt.'));
        _parsing = false;
      });
    }
  }

  Future<void> _loadContacts() async {
    setState(() {
      _loadingContacts = true;
      _contactsError = null;
    });

    try {
      final friends = await ref.read(friendsApiProvider).listFriends();

      final contacts = <CaptureSelectableContact>[
        CaptureSelectableContact.friend(
          id: 'self',
          label: 'You',
          user: _flow.currentUser,
        ),
        ...friends.map(
          (friendship) => CaptureSelectableContact.friend(
            id: friendship.id,
            label: displayName(friendship.friend),
            user: friendship.friend,
          ),
        ),
      ];

      if (!mounted) return;
      setState(() {
        _contacts = contacts;
        if (_flow.isEditing && _flow.participants.isNotEmpty) {
          final participantIds = _flow.participants.map((user) => user.id).toSet();
          _selectedIds
            ..clear()
            ..addAll(
              contacts
                  .where((contact) => contact.user != null && participantIds.contains(contact.user!.id))
                  .map((contact) => contact.id),
            );
        }
        _loadingContacts = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _contactsError = e.toString();
        _loadingContacts = false;
      });
    }
  }

  void _toggleSelected(CaptureSelectableContact contact) {
    setState(() {
      if (_selectedIds.contains(contact.id)) {
        _selectedIds.remove(contact.id);
        if (contact.user?.id == _payerId) {
          _payerId = _flow.currentUser.id;
        }
      } else {
        _selectedIds.add(contact.id);
      }
    });
  }

  void _togglePaid(CaptureSelectableContact contact) {
    if (!_selectedIds.contains(contact.id)) return;
    if (contact.user != null) {
      setState(() => _payerId = contact.user!.id);
    }
  }

  Future<void> _continue() async {
    final receipt = _flow.receipt;
    if (receipt == null || _payerId == null || _selectedIds.isEmpty) return;

    setState(() => _loadingContacts = true);

    try {
      final participants = <User>{_flow.currentUser};

      for (final contact in _contacts) {
        if (!_selectedIds.contains(contact.id)) continue;

        if (contact.user != null && contact.id != 'self') {
          participants.add(contact.user!);
        }
      }

      final nextFlow = _flow.copyWith(
        participants: participants.toList()
          ..sort((a, b) => displayName(a).compareTo(displayName(b))),
        payerId: _payerId,
      );

      if (!mounted) return;
      final splitPath = nextFlow.isEditing
          ? '/bills/${nextFlow.billId}/edit/split'
          : '/dashboard/capture/split';
      context.push(splitPath, extra: nextFlow);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _contactsError = e.toString();
        _loadingContacts = false;
      });
    }
  }

  Widget _paidChip(CaptureSelectableContact contact) {
    final active = contact.user?.id == _payerId;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: active ? AppColors.accent : Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: active ? AppColors.accent : AppColors.border,
          width: 2.5,
        ),
      ),
      child: Text(
        'Paid',
        style: TextStyle(
          fontWeight: FontWeight.w700,
          fontSize: 12,
          color: active ? Colors.white : AppColors.text,
        ),
      ),
    );
  }

  bool get _canContinue =>
      !_parsing &&
      _flow.receipt != null &&
      _selectedIds.isNotEmpty &&
      _payerId != null;

  String _payerName() {
    final payer = _contacts
        .where((contact) => contact.user?.id == _payerId)
        .map((contact) => contact.user)
        .firstOrNull;
    return payer == null ? 'You' : displayName(payer);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Select participants')),
      body: _loadingContacts && _contacts.isEmpty
          ? const LoadingView(message: 'Loading friends...')
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const BillFlowStepHeader(stepNumber: 1, totalSteps: 3, title: 'Participants'),
                      const SizedBox(height: 12),
                      if (_parsing)
                        const Row(
                          children: [
                            SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                            SizedBox(width: 12),
                            Text('Reading receipt...'),
                          ],
                        )
                      else if (_flow.parseError != null)
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            ErrorBanner(message: _flow.parseError!),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Expanded(
                                  child: SecondaryButton(
                                    label: 'Retake photo',
                                    onPressed: () => context.pop(),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: SecondaryButton(
                                    label: 'Retry parse',
                                    onPressed: _parseReceipt,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        )
                      else if (_flow.receipt != null)
                        BillFlowSummaryCard(
                          receipt: _flow.receipt!,
                          payerName: _payerName(),
                          incurredAt: _flow.incurredAt,
                          eyebrowText: _flow.isEditing ? 'Editing receipt' : 'Captured receipt',
                        ),
                    ],
                  ),
                ),
                if (_contactsError != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: ErrorBanner(message: _contactsError!),
                  ),
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                    itemCount: _contacts.length,
                    itemBuilder: (context, index) {
                      final contact = _contacts[index];
                      final checked = _selectedIds.contains(contact.id);

                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        clipBehavior: Clip.antiAlias,
                        child: InkWell(
                          onTap: () => _toggleSelected(contact),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            child: Row(
                              children: [
                                Checkbox(
                                  value: checked,
                                  activeColor: AppColors.accent,
                                  onChanged: (_) => _toggleSelected(contact),
                                ),
                                Expanded(
                                  child: Text(
                                    contact.label,
                                    style: const TextStyle(fontWeight: FontWeight.w600),
                                  ),
                                ),
                                GestureDetector(
                                  onTap: checked ? () => _togglePaid(contact) : null,
                                  behavior: HitTestBehavior.opaque,
                                  child: _paidChip(contact),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: PrimaryButton(
                    label: _flow.isEditing ? 'Continue to assignment' : 'Continue',
                    onPressed: _canContinue ? _continue : null,
                    isLoading: _loadingContacts && _contacts.isNotEmpty,
                  ),
                ),
              ],
            ),
    );
  }
}
