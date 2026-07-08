import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../api/api_exception.dart';
import '../../models/models.dart';
import '../../models/user.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../../widgets/common_widgets.dart';

class ManualSplitEntry {
  const ManualSplitEntry({
    required this.user,
    required this.shareCents,
  });

  final User user;
  final int shareCents;
}

class ManualReceiptScreen extends ConsumerStatefulWidget {
  const ManualReceiptScreen({super.key, this.initialBill});

  final Bill? initialBill;

  @override
  ConsumerState<ManualReceiptScreen> createState() => _ManualReceiptScreenState();
}

class _ManualReceiptScreenState extends ConsumerState<ManualReceiptScreen> {
  final _titleController = TextEditingController();
  final _amountController = TextEditingController();
  final _splitAmountControllers = <String, TextEditingController>{};
  final _titleFocusNode = FocusNode();
  final _amountFocusNode = FocusNode();

  List<User> _friends = [];
  List<ManualSplitEntry> _splitEntries = [];
  bool _loadingFriends = true;
  bool _saving = false;
  String? _error;
  String? _titleError;
  String? _amountError;

  @override
  void initState() {
    super.initState();
    final bill = widget.initialBill;
    if (bill != null) {
      _titleController.text = bill.description;
      _amountController.text = (bill.totalCents / 100).toStringAsFixed(2);
      _splitEntries = bill.shares
          .where((share) => share.user.id != bill.payerId)
          .map(
            (share) => ManualSplitEntry(
              user: share.user,
              shareCents: share.shareCents,
            ),
          )
          .toList()
        ..sort((a, b) => displayName(a.user).compareTo(displayName(b.user)));
    }
    _loadFriends();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _amountController.dispose();
    _titleFocusNode.dispose();
    _amountFocusNode.dispose();
    for (final controller in _splitAmountControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  void _dismissKeyboard() {
    FocusManager.instance.primaryFocus?.unfocus();
  }

  Future<void> _openFriendPicker() async {
    if (_friends.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add friends first to split a bill.')),
      );
      return;
    }

    _dismissKeyboard();
    await Future<void>.delayed(const Duration(milliseconds: 120));
    if (!mounted) return;

    final selectedIds = {
      for (final entry in _splitEntries) entry.user.id,
    };

    final confirmed = await showModalBottomSheet<List<User>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => _FriendPickerSheet(
        friends: _friends,
        initiallySelectedIds: selectedIds,
      ),
    );

    if (confirmed == null) return;
    _applySelectedFriends(confirmed);
  }

  Future<void> _loadFriends() async {
    setState(() {
      _loadingFriends = true;
      _error = null;
    });

    try {
      final friendships = await ref.read(friendsApiProvider).listFriends();
      if (!mounted) return;
      setState(() {
        _friends = friendships.map((friendship) => friendship.friend).toList()
          ..sort((a, b) => displayName(a).compareTo(displayName(b)));
        _loadingFriends = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = apiErrorMessage(e, 'Unable to load friends.');
        _loadingFriends = false;
      });
    }
  }

  int? get _totalCents {
    final raw = _amountController.text.trim().replaceAll(',', '');
    if (raw.isEmpty) return null;
    final parsed = double.tryParse(raw);
    if (parsed == null || parsed <= 0) return null;
    return (parsed * 100).round();
  }

  int get _friendSplitTotalCents =>
      _splitEntries.fold<int>(0, (sum, entry) => sum + entry.shareCents);

  int? get _ownerShareCents {
    final total = _totalCents;
    if (total == null) return null;
    return total - _friendSplitTotalCents;
  }

  bool get _canSavePayload {
    final title = _titleController.text.trim();
    final total = _totalCents;
    if (title.isEmpty || total == null) return false;
    if (_splitEntries.isNotEmpty) {
      final ownerShare = _ownerShareCents;
      if (ownerShare == null || ownerShare < 0) return false;
      if (_friendSplitTotalCents > total) return false;
      if (_splitEntries.any((entry) => entry.shareCents <= 0)) return false;
    }
    return true;
  }

  String? _validateTitle() {
    if (_titleController.text.trim().isEmpty) {
      return 'Enter a bill title';
    }
    return null;
  }

  String? _validateAmount() {
    final raw = _amountController.text.trim().replaceAll(',', '');
    if (raw.isEmpty) {
      return 'Enter the amount paid';
    }
    final parsed = double.tryParse(raw);
    if (parsed == null || parsed <= 0) {
      return 'Enter an amount greater than zero';
    }
    return null;
  }

  bool _validateForm() {
    final titleError = _validateTitle();
    final amountError = _validateAmount();
    String? splitError;

    if (titleError == null && amountError == null && !_canSavePayload && _splitEntries.isNotEmpty) {
      splitError = 'Adjust friend amounts so they add up to the total.';
    }

    setState(() {
      _titleError = titleError;
      _amountError = amountError;
      _error = titleError == null && amountError == null ? splitError : null;
    });

    if (titleError != null) {
      _titleFocusNode.requestFocus();
      return false;
    }
    if (amountError != null) {
      _amountFocusNode.requestFocus();
      return false;
    }
    if (!_canSavePayload) {
      return false;
    }

    return true;
  }

  void _clearTitleError() {
    if (_titleError == null) return;
    setState(() => _titleError = null);
  }

  void _clearAmountError() {
    if (_amountError == null) return;
    setState(() => _amountError = null);
  }

  TextEditingController _controllerForUser(String userId, {int? initialCents}) {
    return _splitAmountControllers.putIfAbsent(
      userId,
      () => TextEditingController(
        text: initialCents == null || initialCents == 0
            ? ''
            : (initialCents / 100).toStringAsFixed(2),
      ),
    );
  }

  void _syncSplitEntry(String userId, String rawValue) {
    final parsed = double.tryParse(rawValue.replaceAll(',', '').trim());
    final cents = parsed == null ? 0 : (parsed * 100).round();
    final user = _splitEntries.firstWhere((entry) => entry.user.id == userId).user;
    final existingIndex = _splitEntries.indexWhere((entry) => entry.user.id == userId);

    setState(() {
      final entry = ManualSplitEntry(user: user, shareCents: cents);
      if (existingIndex >= 0) {
        _splitEntries = [..._splitEntries];
        _splitEntries[existingIndex] = entry;
      }
    });
  }

  void _applySelectedFriends(List<User> selectedFriends) {
    final existingAmounts = {
      for (final entry in _splitEntries) entry.user.id: entry.shareCents,
    };

    final selectedIds = selectedFriends.map((user) => user.id).toSet();
    for (final userId in _splitAmountControllers.keys.toList()) {
      if (!selectedIds.contains(userId)) {
        _splitAmountControllers.remove(userId)?.dispose();
      }
    }

    setState(() {
      _splitEntries = selectedFriends
          .map(
            (user) => ManualSplitEntry(
              user: user,
              shareCents: existingAmounts[user.id] ?? 0,
            ),
          )
          .toList();
    });
  }

  Widget _buildFieldError(String? message) {
    return AnimatedSize(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOutCubic,
      alignment: Alignment.topLeft,
      clipBehavior: Clip.none,
      child: message == null
          ? const SizedBox.shrink()
          : Padding(
              padding: const EdgeInsets.only(top: 8, left: 2),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.only(top: 1),
                    child: Icon(
                      Icons.error_outline_rounded,
                      size: 15,
                      color: AppColors.error,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      message,
                      style: const TextStyle(
                        color: AppColors.error,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        height: 1.35,
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildSectionCard({
    required String title,
    required Widget child,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.border, width: 1),
        boxShadow: [
          BoxShadow(
            color: AppColors.textH.withValues(alpha: 0.07),
            blurRadius: 28,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
            decoration: const BoxDecoration(
              gradient: AppColors.brandGradient,
            ),
            child: Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.1,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
            child: child,
          ),
        ],
      ),
    );
  }

  Widget _buildBillDetailsCard() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildSectionCard(
          title: 'Bill Title',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _titleController,
                focusNode: _titleFocusNode,
                maxLength: 120,
                textCapitalization: TextCapitalization.sentences,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textH,
                ),
                decoration: _boxedInputDecoration(
                  hintText: 'Dinner, groceries, rent...',
                  hasError: _titleError != null,
                ),
                onChanged: (_) {
                  _clearTitleError();
                  setState(() {});
                },
              ),
              _buildFieldError(_titleError),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _buildSectionCard(
          title: 'Final Amount Paid',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildAmountField(),
              _buildFieldError(_amountError),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildAmountField() {
    const amountStyle = TextStyle(
      fontSize: 36,
      fontWeight: FontWeight.w800,
      color: AppColors.textH,
      letterSpacing: -0.5,
    );

    return ListenableBuilder(
      listenable: _amountFocusNode,
      builder: (context, _) {
        final focused = _amountFocusNode.hasFocus;
        final hasError = _amountError != null;
        final borderColor = hasError
            ? AppColors.error
            : focused
                ? AppColors.accent
                : AppColors.border;

        return AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOutCubic,
          decoration: BoxDecoration(
            color: hasError ? AppColors.errorBg : AppColors.surfaceMuted,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: borderColor,
              width: hasError || focused ? 1.5 : 1,
            ),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Text(r'$ ', style: amountStyle),
              Expanded(
                child: TextField(
                  controller: _amountController,
                  focusNode: _amountFocusNode,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
                  ],
                  style: amountStyle,
                  decoration: InputDecoration(
                    hintText: '0.00',
                    hintStyle: TextStyle(
                      fontSize: 36,
                      fontWeight: FontWeight.w800,
                      color: AppColors.text.withValues(alpha: 0.35),
                      letterSpacing: -0.5,
                    ),
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    contentPadding: EdgeInsets.zero,
                    isDense: true,
                    filled: false,
                  ),
                  onChanged: (_) {
                    _clearAmountError();
                    setState(() {});
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  InputDecoration _boxedInputDecoration({
    String? hintText,
    String? prefixText,
    TextStyle? hintStyle,
    bool hasError = false,
  }) {
    final borderColor = hasError ? AppColors.error : AppColors.border;
    final focusedColor = hasError ? AppColors.error : AppColors.accent;

    return InputDecoration(
      hintText: hintText,
      hintStyle: hintStyle,
      prefixText: prefixText,
      counterText: '',
      filled: true,
      fillColor: hasError ? AppColors.errorBg : AppColors.surfaceMuted,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: borderColor, width: hasError ? 1.5 : 1),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: borderColor, width: hasError ? 1.5 : 1),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: focusedColor, width: 1.5),
      ),
    );
  }

  Widget _buildOwnerSummary() {
    final total = _totalCents;
    if (total == null || _splitEntries.isEmpty) return const SizedBox.shrink();

    final ownerShare = _ownerShareCents ?? 0;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        gradient: AppColors.brandGradient,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const Expanded(
            child: Text(
              'You pay',
              style: TextStyle(
                color: Colors.white70,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ),
          Text(
            formatCad(ownerShare.clamp(0, total)),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSplitRow(ManualSplitEntry entry) {
    final controller = _controllerForUser(entry.user.id, initialCents: entry.shareCents);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              displayName(entry.user),
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          SizedBox(
            width: 110,
            child: TextField(
              controller: controller,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
              ],
              textAlign: TextAlign.right,
              decoration: InputDecoration(
                isDense: true,
                prefixText: r'$ ',
                hintText: '0.00',
                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: AppColors.accent, width: 2),
                ),
              ),
              onChanged: (value) => _syncSplitEntry(entry.user.id, value),
            ),
          ),
        ],
      ),
    );
  }

  Map<String, dynamic> _buildPayload() {
    final total = _totalCents!;
    final description = _titleController.text.trim();
    final bill = widget.initialBill;

    if (_splitEntries.isEmpty) {
      return {
        'description': description,
        'totalCents': total,
        if (bill != null) 'source': bill.source.name,
      };
    }

    final currentUser = ref.read(authProvider).user!;
    final payerId = bill?.payerId ?? currentUser.id;
    final participantIds = [
      payerId,
      ..._splitEntries.map((entry) => entry.user.id),
    ];
    final ownerShare = _ownerShareCents!;

    return {
      'description': description,
      'totalCents': total,
      'source': bill?.source.name ?? 'manual',
      'participantIds': participantIds,
      'payerId': payerId,
      'shares': [
        {'userId': payerId, 'shareCents': ownerShare},
        ..._splitEntries.map(
          (entry) => {
            'userId': entry.user.id,
            'shareCents': entry.shareCents,
          },
        ),
      ],
    };
  }

  Future<void> _save() async {
    if (_saving) return;
    if (!_validateForm()) return;

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final billId = widget.initialBill?.id;
      final bill = billId == null
          ? await ref.read(billsApiProvider).createBill(_buildPayload())
          : await ref.read(billsApiProvider).updateBill(billId, _buildPayload());
      notifyDataChanged(ref);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            billId == null ? 'Bill saved successfully.' : 'Bill updated successfully.',
          ),
        ),
      );
      context.go('/bills/${bill.id}');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = apiErrorMessage(e, 'Unable to save bill.');
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEditing = widget.initialBill != null;

    return Scaffold(
      appBar: AppBar(title: Text(isEditing ? 'Edit bill' : 'Add bill manually')),
      body: _loadingFriends
          ? const LoadingView(message: 'Loading...')
          : GestureDetector(
              onTap: _dismissKeyboard,
              behavior: HitTestBehavior.opaque,
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  if (_error != null) ...[
                    ErrorBanner(message: _error!),
                    const SizedBox(height: 16),
                  ],
                  _buildBillDetailsCard(),
                  const SizedBox(height: 20),
                  if (_splitEntries.isEmpty)
                    SecondaryButton(
                      label: 'Split with friends',
                      onPressed: _openFriendPicker,
                    ),
                  if (_splitEntries.isNotEmpty) ...[
                    const Text(
                      'Friend amounts',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                        color: AppColors.textH,
                      ),
                    ),
                    const SizedBox(height: 12),
                    _buildOwnerSummary(),
                    const SizedBox(height: 12),
                    ..._splitEntries.map(_buildSplitRow),
                    const SizedBox(height: 12),
                    SecondaryButton(
                      label: 'Edit friends',
                      onPressed: _openFriendPicker,
                    ),
                  ],
                  const SizedBox(height: 24),
                  const Divider(height: 1, color: AppColors.border),
                  const SizedBox(height: 24),
                  PrimaryButton(
                    label: isEditing ? 'Save changes' : 'Save bill',
                    isLoading: _saving,
                    onPressed: _saving ? null : _save,
                  ),
                ],
              ),
            ),
    );
  }
}

class _FriendPickerSheet extends StatefulWidget {
  const _FriendPickerSheet({
    required this.friends,
    required this.initiallySelectedIds,
  });

  final List<User> friends;
  final Set<String> initiallySelectedIds;

  @override
  State<_FriendPickerSheet> createState() => _FriendPickerSheetState();
}

class _FriendPickerSheetState extends State<_FriendPickerSheet> {
  late final TextEditingController _searchController;
  late final Set<String> _pendingIds;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
    _pendingIds = Set<String>.from(widget.initiallySelectedIds);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<User> get _filteredFriends {
    if (_query.isEmpty) return widget.friends;
    final q = _query.toLowerCase();
    return widget.friends.where((friend) {
      final name = displayName(friend).toLowerCase();
      final email = friend.email.toLowerCase();
      return name.contains(q) || email.contains(q);
    }).toList();
  }

  void _toggleFriend(String friendId) {
    setState(() {
      if (_pendingIds.contains(friendId)) {
        _pendingIds.remove(friendId);
      } else {
        _pendingIds.add(friendId);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final filteredFriends = _filteredFriends;

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search friends',
              prefixIcon: const Icon(Icons.search, color: AppColors.text),
              filled: true,
              fillColor: AppColors.surfaceMuted,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            ),
            onChanged: (value) => setState(() => _query = value.trim()),
          ),
          const SizedBox(height: 12),
          Text(
            'Choose friends',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppColors.textH,
                ),
          ),
          const SizedBox(height: 8),
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.45,
            ),
            child: filteredFriends.isEmpty
                ? const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Text(
                      'No friends match your search.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.text),
                    ),
                  )
                : ListView.separated(
                    shrinkWrap: true,
                    itemCount: filteredFriends.length,
                    separatorBuilder: (context, index) =>
                        const Divider(height: 1, color: AppColors.border),
                    itemBuilder: (context, index) {
                      final friend = filteredFriends[index];
                      final checked = _pendingIds.contains(friend.id);

                      return InkWell(
                        onTap: () => _toggleFriend(friend.id),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          child: Row(
                            children: [
                              Checkbox(
                                value: checked,
                                activeColor: AppColors.accent,
                                onChanged: (_) => _toggleFriend(friend.id),
                              ),
                              Expanded(
                                child: Text(
                                  displayName(friend),
                                  style: const TextStyle(fontWeight: FontWeight.w600),
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
          const SizedBox(height: 16),
          PrimaryButton(
            label: 'Submit',
            onPressed: () {
              final selected = widget.friends
                  .where((friend) => _pendingIds.contains(friend.id))
                  .toList();
              Navigator.pop(context, selected);
            },
          ),
        ],
      ),
    );
  }
}
