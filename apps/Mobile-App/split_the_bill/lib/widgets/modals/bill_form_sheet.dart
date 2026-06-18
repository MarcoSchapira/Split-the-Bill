import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../api/api_exception.dart';
import '../../models/models.dart';
import '../../models/user.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../utils/bill_split.dart';
import '../../utils/format.dart';
import '../common_widgets.dart';

class BillTarget {
  const BillTarget({required this.targetType, required this.targetId});

  final TargetType targetType;
  final String targetId;

  String get key => '${targetType.name}:$targetId';
}

class BillFormSheet extends ConsumerStatefulWidget {
  const BillFormSheet({
    super.key,
    this.bill,
    this.fixedTarget,
    this.onSaved,
  });

  final Bill? bill;
  final BillTarget? fixedTarget;
  final VoidCallback? onSaved;

  @override
  ConsumerState<BillFormSheet> createState() => _BillFormSheetState();
}

class _BillFormSheetState extends ConsumerState<BillFormSheet> {
  final _descriptionController = TextEditingController();
  final _amountController = TextEditingController();

  List<FriendshipSummary> _friends = [];
  List<GroupSummary> _groups = [];
  GroupDetail? _loadedGroup;
  String? _selectedTargetKey;
  DateTime _date = DateTime.now();
  String _payerId = '';
  SplitKind _splitKind = SplitKind.equal;
  CustomSplitMode _customMode = CustomSplitMode.amount;
  List<MemberSplitState> _members = [];
  String? _error;
  bool _isSaving = false;
  bool _loadingContext = true;

  @override
  void initState() {
    super.initState();
    final bill = widget.bill;
    if (bill != null) {
      _descriptionController.text = bill.description;
      _date = DateTime.parse(bill.incurredAt);
      _amountController.text = (bill.totalCents / 100).toStringAsFixed(2);
      _payerId = bill.payerId;
      _selectedTargetKey = widget.fixedTarget?.key ??
          (bill.targetType != null && (bill.friendshipId ?? bill.groupId) != null
              ? '${bill.targetType!.name}:${bill.friendshipId ?? bill.groupId}'
              : null);
    } else if (widget.fixedTarget != null) {
      _selectedTargetKey = widget.fixedTarget!.key;
    }
    _loadContext();
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  int get _totalCents {
    final parsed = double.tryParse(_amountController.text.trim()) ?? 0;
    return (parsed * 100).round();
  }

  Future<void> _loadContext() async {
    try {
      final friends = await ref.read(friendsApiProvider).listFriends();
      final groups = await ref.read(groupsApiProvider).listGroups();
      final user = ref.read(authProvider).user;
      if (!mounted) return;
      setState(() {
        _friends = friends;
        _groups = groups;
        _loadingContext = false;
        _selectedTargetKey ??= friends.isNotEmpty
            ? 'friendship:${friends.first.id}'
            : groups.isNotEmpty
                ? 'group:${groups.first.id}'
                : null;
        if (_payerId.isEmpty) _payerId = user?.id ?? '';
      });
      await _loadGroupIfNeeded();
      _initMembers();
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = apiErrorMessage(e);
          _loadingContext = false;
        });
      }
    }
  }

  BillTarget? get _target {
    final key = _selectedTargetKey;
    if (key == null) return null;
    final parts = key.split(':');
    if (parts.length != 2) return null;
    return BillTarget(
      targetType: parts[0] == 'group' ? TargetType.group : TargetType.friendship,
      targetId: parts[1],
    );
  }

  List<User> get _participants {
    final target = _target;
    final user = ref.read(authProvider).user;
    if (target == null || user == null) return [];

    if (target.targetType == TargetType.friendship) {
      final friendship = _friends.where((f) => f.id == target.targetId).firstOrNull;
      if (friendship == null) return [user];
      return [user, friendship.friend];
    }

    if (_loadedGroup?.id == target.targetId) {
      return _loadedGroup!.members.map((m) => m.user).toList();
    }
    return [];
  }

  Future<void> _loadGroupIfNeeded() async {
    final target = _target;
    if (target?.targetType != TargetType.group) {
      setState(() => _loadedGroup = null);
      return;
    }
    try {
      final group = await ref.read(groupsApiProvider).getGroup(target!.targetId);
      if (mounted) setState(() => _loadedGroup = group);
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Unable to load group members.'));
    }
  }

  void _initMembers() {
    final participants = _participants;
    if (participants.isEmpty) {
      setState(() => _members = []);
      return;
    }

    final bill = widget.bill;
    final totalCents = _totalCents;
    List<BillShareDraft>? existingShares;
    final sameParticipants = bill != null &&
        bill.shares.length == participants.length &&
        participants.every((participant) => bill.shares.any((share) => share.user.id == participant.id));
    if (sameParticipants) {
      existingShares = bill.shares
          .map((s) => BillShareDraft(userId: s.user.id, shareCents: s.shareCents))
          .toList();
    }

    final initialized = initializeMemberState(
      participants,
      existingShares: existingShares,
      totalCents: existingShares != null ? bill!.totalCents : (totalCents > 0 ? totalCents : 0),
    );

    setState(() {
      _splitKind = initialized.splitKind;
      _customMode = initialized.customMode;
      _members = initialized.splitKind == SplitKind.equal && totalCents > 0
          ? syncEqualMemberAmounts(initialized.members, totalCents)
          : initialized.members;
    });
  }

  Future<void> _onTargetChanged(String? key) async {
    setState(() => _selectedTargetKey = key);
    await _loadGroupIfNeeded();
    _initMembers();
  }

  void _syncEqualAmounts() {
    if (_splitKind != SplitKind.equal || _totalCents <= 0) return;
    setState(() => _members = syncEqualMemberAmounts(_members, _totalCents));
  }

  Future<void> _submit() async {
    final target = _target;
    final totalCentsInt = _totalCents;

    if (target == null || totalCentsInt <= 0) {
      setState(() => _error = 'Enter participants and a positive amount.');
      return;
    }

    final shareResult = buildSharesFromMemberState(
      totalCents: totalCentsInt,
      splitKind: _splitKind,
      customMode: _customMode,
      members: _members,
    );

    if (shareResult.error != null) {
      setState(() => _error = shareResult.error);
      return;
    }

    final participants = _participants;
    final participantIds = _members
        .where((member) => member.included)
        .map((member) => member.user.id)
        .toList();
    if (participantIds.isEmpty) {
      setState(() => _error = 'Include at least one participant.');
      return;
    }

    final payerId = participants.any((p) => p.id == _payerId)
        ? _payerId
        : (participants.firstOrNull?.id ?? '');

    final input = <String, dynamic>{
      'description': _descriptionController.text.trim(),
      'incurredAt': DateTime.utc(_date.year, _date.month, _date.day).toIso8601String(),
      'totalCents': totalCentsInt,
      'source': widget.bill?.source.name ?? BillSource.manual.name,
      'participantIds': participantIds,
      'payerId': payerId,
      if (shareResult.shares != null)
        'shares': shareResult.shares!
            .map((s) => {'userId': s.userId, 'shareCents': s.shareCents})
            .toList(),
    };

    setState(() {
      _error = null;
      _isSaving = true;
    });

    try {
      final billsApi = ref.read(billsApiProvider);
      if (widget.bill != null) {
        await billsApi.updateBill(widget.bill!.id, input);
      } else {
        await billsApi.createBill(input);
      }
      notifyDataChanged(ref);
      widget.onSaved?.call();
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      setState(() => _error = apiErrorMessage(e, 'Unable to save bill.'));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loadingContext) {
      return const SizedBox(height: 200, child: LoadingView());
    }

    if (_selectedTargetKey == null) {
      return const Padding(
        padding: EdgeInsets.all(24),
        child: EmptyState(
          message: 'Accept a friend or join a group before adding a bill.',
        ),
      );
    }

    final targetLocked = (widget.fixedTarget != null && widget.bill == null) ||
        (widget.bill != null && !widget.bill!.canRetarget);
    final participants = _participants;
    final choices = [
      ..._friends.map((f) => ('friendship:${f.id}', 'Friend: ${displayName(f.friend)}')),
      ..._groups.map((g) => ('group:${g.id}', 'Group: ${g.name}')),
    ];

    return SingleChildScrollView(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 24,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.bill == null ? 'Add bill' : 'Edit bill',
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
          DropdownButtonFormField<String>(
            value: _selectedTargetKey,
            decoration: const InputDecoration(labelText: 'Split with'),
            items: choices
                .map((c) => DropdownMenuItem(value: c.$1, child: Text(c.$2)))
                .toList(),
            onChanged: targetLocked ? null : _onTargetChanged,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _descriptionController,
            decoration: const InputDecoration(labelText: 'Description'),
            maxLength: 120,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _amountController,
                  decoration: const InputDecoration(labelText: 'Amount (CAD)'),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  onChanged: (_) => _syncEqualAmounts(),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: InkWell(
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: _date,
                      firstDate: DateTime(2000),
                      lastDate: DateTime(2100),
                    );
                    if (picked != null) setState(() => _date = picked);
                  },
                  child: InputDecorator(
                    decoration: const InputDecoration(labelText: 'Date'),
                    child: Text(
                      '${_date.year}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}',
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: participants.any((p) => p.id == _payerId)
                ? _payerId
                : participants.firstOrNull?.id,
            decoration: const InputDecoration(labelText: 'Paid by'),
            items: participants
                .map((p) => DropdownMenuItem(value: p.id, child: Text(displayName(p))))
                .toList(),
            onChanged: (v) => setState(() => _payerId = v ?? ''),
          ),
          const SizedBox(height: 16),
          _SplitControls(
            splitKind: _splitKind,
            customMode: _customMode,
            onSplitKindChanged: (k) => setState(() {
              _splitKind = k;
              _syncEqualAmounts();
            }),
            onCustomModeChanged: (m) => setState(() => _customMode = m),
          ),
          if (participants.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text('Who shares this bill?', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            ..._members.map(_buildMemberRow),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: SecondaryButton(label: 'Cancel', onPressed: () => Navigator.pop(context))),
              const SizedBox(width: 12),
              Expanded(
                child: PrimaryButton(
                  label: widget.bill == null ? 'Add bill' : 'Save changes',
                  onPressed: _submit,
                  isLoading: _isSaving,
                  compact: true,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMemberRow(MemberSplitState member) {
    final readOnly = _splitKind == SplitKind.equal;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Checkbox(
                  value: member.included,
                  activeColor: AppColors.accent,
                  onChanged: (v) {
                    setState(() {
                      final next = _members.map((m) {
                        if (m.user.id != member.user.id) return m;
                        return m.copyWith(included: v ?? false);
                      }).toList();
                      _members = _splitKind == SplitKind.equal && _totalCents > 0
                          ? syncEqualMemberAmounts(next, _totalCents)
                          : next;
                    });
                  },
                ),
                Expanded(child: Text(displayName(member.user))),
              ],
            ),
            if (member.included && !readOnly)
              _customMode == CustomSplitMode.amount
                  ? TextField(
                      decoration: const InputDecoration(labelText: 'Amount'),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      controller: TextEditingController(text: member.amount),
                      onChanged: (v) {
                        final idx = _members.indexWhere((m) => m.user.id == member.user.id);
                        if (idx >= 0) _members[idx] = _members[idx].copyWith(amount: v);
                      },
                    )
                  : TextField(
                      decoration: const InputDecoration(labelText: 'Percent'),
                      keyboardType: TextInputType.number,
                      controller: TextEditingController(text: member.percent),
                      onChanged: (v) {
                        final idx = _members.indexWhere((m) => m.user.id == member.user.id);
                        if (idx >= 0) _members[idx] = _members[idx].copyWith(percent: v);
                      },
                    ),
            if (member.included && readOnly && member.amount.isNotEmpty)
              Text('Share: \$${member.amount}'),
          ],
        ),
      ),
    );
  }
}

class _SplitControls extends StatelessWidget {
  const _SplitControls({
    required this.splitKind,
    required this.customMode,
    required this.onSplitKindChanged,
    required this.onCustomModeChanged,
  });

  final SplitKind splitKind;
  final CustomSplitMode customMode;
  final ValueChanged<SplitKind> onSplitKindChanged;
  final ValueChanged<CustomSplitMode> onCustomModeChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SegmentedButton<SplitKind>(
          segments: const [
            ButtonSegment(value: SplitKind.equal, label: Text('Equal')),
            ButtonSegment(value: SplitKind.custom, label: Text('Custom')),
          ],
          selected: {splitKind},
          onSelectionChanged: (s) => onSplitKindChanged(s.first),
        ),
        if (splitKind == SplitKind.custom) ...[
          const SizedBox(height: 8),
          SegmentedButton<CustomSplitMode>(
            segments: const [
              ButtonSegment(value: CustomSplitMode.amount, label: Text('Amount')),
              ButtonSegment(value: CustomSplitMode.percent, label: Text('Percent')),
            ],
            selected: {customMode},
            onSelectionChanged: (s) => onCustomModeChanged(s.first),
          ),
        ],
      ],
    );
  }
}
