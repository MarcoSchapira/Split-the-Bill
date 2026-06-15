import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../api/api_exception.dart';
import '../../models/models.dart';
import '../../models/receipt.dart';
import '../../models/user.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../../widgets/common_widgets.dart';

class CaptureParticipantsScreen extends ConsumerStatefulWidget {
  const CaptureParticipantsScreen({super.key, required this.flow});

  final CaptureFlowState flow;

  @override
  ConsumerState<CaptureParticipantsScreen> createState() =>
      _CaptureParticipantsScreenState();
}

class _CaptureParticipantsScreenState extends ConsumerState<CaptureParticipantsScreen> {
  late CaptureFlowState _flow;
  List<CaptureSelectableContact> _contacts = [];
  final Set<String> _selectedIds = {};
  String? _payerId;
  bool _loadingContacts = true;
  bool _parsing = true;
  String? _contactsError;
  final Map<String, GroupDetail> _groupDetails = {};

  @override
  void initState() {
    super.initState();
    _flow = widget.flow;
    _payerId = widget.flow.payerId ?? widget.flow.currentUser.id;
    _loadContacts();
    _parseReceipt();
  }

  Future<void> _parseReceipt() async {
    setState(() {
      _parsing = true;
      _flow = _flow.copyWith(clearParseError: true);
    });

    try {
      final receipt = await ref.read(receiptsApiProvider).parseReceipt(
            Uint8List.fromList(_flow.imageBytes),
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
      final results = await Future.wait([
        ref.read(friendsApiProvider).listFriends(),
        ref.read(groupsApiProvider).listGroups(),
      ]);
      final friends = results[0] as List<FriendshipSummary>;
      final groups = results[1] as List<GroupSummary>;

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
        ...groups.map(
          (group) => CaptureSelectableContact.group(
            id: group.id,
            label: group.name,
            groupId: group.id,
          ),
        ),
      ];

      if (!mounted) return;
      setState(() {
        _contacts = contacts;
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

  Future<void> _pickGroupPayer(CaptureSelectableContact contact) async {
    final groupId = contact.groupId;
    if (groupId == null) return;

    GroupDetail? detail = _groupDetails[groupId];
    detail ??= await ref.read(groupsApiProvider).getGroup(groupId);
    _groupDetails[groupId] = detail;

    if (!mounted) return;

    final selected = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Who paid?',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 12),
                ...detail!.members.map(
                  (member) => ListTile(
                    title: Text(displayName(member.user)),
                    onTap: () => Navigator.pop(context, member.user.id),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );

    if (selected != null) {
      setState(() => _payerId = selected);
    }
  }

  void _togglePaid(CaptureSelectableContact contact) {
    if (!_selectedIds.contains(contact.id)) return;

    if (contact.kind == CaptureContactKind.friend && contact.user != null) {
      setState(() => _payerId = contact.user!.id);
      return;
    }

    if (contact.kind == CaptureContactKind.group) {
      _pickGroupPayer(contact);
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

        if (contact.kind == CaptureContactKind.friend && contact.user != null) {
          if (contact.id != 'self') {
            participants.add(contact.user!);
          }
          continue;
        }

        if (contact.kind == CaptureContactKind.group && contact.groupId != null) {
          final detail = _groupDetails[contact.groupId!] ??
              await ref.read(groupsApiProvider).getGroup(contact.groupId!);
          _groupDetails[contact.groupId!] = detail;
          for (final member in detail.members) {
            participants.add(member.user);
          }
        }
      }

      final nextFlow = _flow.copyWith(
        participants: participants.toList()
          ..sort((a, b) => displayName(a).compareTo(displayName(b))),
        payerId: _payerId,
      );

      if (!mounted) return;
      context.push('/dashboard/capture/split', extra: nextFlow);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _contactsError = e.toString();
        _loadingContacts = false;
      });
    }
  }

  Widget _paidChip(CaptureSelectableContact contact) {
    final isSelected = contact.kind == CaptureContactKind.friend &&
        contact.user?.id == _payerId;
    final isGroupSelected = contact.kind == CaptureContactKind.group &&
        _selectedIds.contains(contact.id) &&
        contact.groupId != null &&
        (_groupDetails[contact.groupId!]?.members
                .any((member) => member.user.id == _payerId) ??
            false);

    final active = isSelected || isGroupSelected;
    final enabled = _selectedIds.contains(contact.id);

    return GestureDetector(
      onTap: enabled ? () => _togglePaid(contact) : null,
      child: AnimatedContainer(
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
      ),
    );
  }

  bool get _canContinue =>
      !_parsing &&
      _flow.receipt != null &&
      _selectedIds.isNotEmpty &&
      _payerId != null;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Select participants')),
      body: _loadingContacts && _contacts.isEmpty
          ? const LoadingView(message: 'Loading friends and groups...')
          : Column(
              children: [
                if (_parsing)
                  const LinearProgressIndicator(minHeight: 3, color: AppColors.accent),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: _parsing
                      ? const Row(
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
                      : _flow.parseError != null
                          ? Column(
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
                          : Text(
                              _flow.receipt?.storeName ?? 'Receipt ready',
                              style: const TextStyle(fontWeight: FontWeight.w600),
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
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          child: Row(
                            children: [
                              Checkbox(
                                value: checked,
                                activeColor: AppColors.accent,
                                onChanged: (value) {
                                  setState(() {
                                    if (value == true) {
                                      _selectedIds.add(contact.id);
                                    } else {
                                      _selectedIds.remove(contact.id);
                                      if (contact.kind == CaptureContactKind.friend &&
                                          contact.user?.id == _payerId) {
                                        _payerId = _flow.currentUser.id;
                                      }
                                    }
                                  });
                                },
                              ),
                              Expanded(
                                child: Text(
                                  contact.label,
                                  style: const TextStyle(fontWeight: FontWeight.w600),
                                ),
                              ),
                              _paidChip(contact),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: PrimaryButton(
                    label: 'Continue',
                    onPressed: _canContinue ? _continue : null,
                    isLoading: _loadingContacts && _contacts.isNotEmpty,
                  ),
                ),
              ],
            ),
    );
  }
}
