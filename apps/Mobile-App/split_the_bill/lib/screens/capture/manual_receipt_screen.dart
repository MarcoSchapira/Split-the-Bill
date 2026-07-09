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

enum _AdjustmentInputMode { percent, amount }

class _ManualLineItemRow {
  _ManualLineItemRow({
    String quantity = '1',
    String title = '',
    String price = '',
  })  : quantityController = TextEditingController(text: quantity),
        titleController = TextEditingController(text: title),
        priceController = TextEditingController(text: price);

  final TextEditingController quantityController;
  final TextEditingController titleController;
  final TextEditingController priceController;

  void dispose() {
    quantityController.dispose();
    titleController.dispose();
    priceController.dispose();
  }

  int get lineTotalCents {
    final qty = double.tryParse(quantityController.text.trim()) ?? 0;
    final price = double.tryParse(priceController.text.trim().replaceAll(',', '')) ?? 0;
    if (qty <= 0 || price < 0) return 0;
    return (qty * price * 100).round();
  }

  bool get hasContent =>
      titleController.text.trim().isNotEmpty ||
      priceController.text.trim().isNotEmpty ||
      quantityController.text.trim() != '1';
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
  final _taxController = TextEditingController(text: '13');
  final _tipController = TextEditingController(text: '0');
  final _splitAmountControllers = <String, TextEditingController>{};
  final _titleFocusNode = FocusNode();
  final _amountFocusNode = FocusNode();

  List<User> _friends = [];
  List<ManualSplitEntry> _splitEntries = [];
  List<_ManualLineItemRow> _lineItemRows = [];
  Set<String> _selectedFriendIds = <String>{};
  String? _selectedPayerId;
  bool _amountSectionExpanded = false;
  bool _lineItemsEnabled = false;
  bool _loadingFriends = true;
  bool _saving = false;
  _AdjustmentInputMode _taxInputMode = _AdjustmentInputMode.percent;
  _AdjustmentInputMode _tipInputMode = _AdjustmentInputMode.percent;
  String? _error;
  String? _titleError;
  String? _amountError;

  @override
  void initState() {
    super.initState();
    final currentUser = ref.read(authProvider).user;
    final bill = widget.initialBill;
    if (bill != null) {
      _titleController.text = bill.description;
      _amountController.text = (bill.totalCents / 100).toStringAsFixed(2);
      _selectedPayerId = bill.payerId;
      _selectedFriendIds = bill.shares
          .map((share) => share.user.id)
          .where((id) => id != currentUser?.id)
          .toSet();
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

      if (bill.lineItems.isNotEmpty) {
        _amountSectionExpanded = true;
        _lineItemsEnabled = true;
        final sortedItems = [...bill.lineItems]..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
        _lineItemRows = sortedItems
            .map(
              (item) => _ManualLineItemRow(
                quantity: _formatQuantity(item.quantity),
                title: item.name,
                price: (item.unitPriceCents / 100).toStringAsFixed(2),
              ),
            )
            .toList();
        _initializeTaxAndTipFromBill(bill);
      }
    } else {
      _selectedPayerId = currentUser?.id;
    }
    if (_lineItemRows.isEmpty && _lineItemsEnabled) {
      _lineItemRows = [_ManualLineItemRow()];
    }
    _loadFriends();
  }

  User get _currentUser {
    final user = ref.read(authProvider).user;
    if (user == null) {
      throw StateError('Current user not available.');
    }
    return user;
  }

  List<User> get _selectedFriendUsers {
    final selected = _friends.where((friend) => _selectedFriendIds.contains(friend.id)).toList();
    selected.sort((a, b) => displayName(a).compareTo(displayName(b)));
    return selected;
  }

  List<User> get _participants {
    return [_currentUser, ..._selectedFriendUsers];
  }

  String _formatQuantity(double quantity) {
    if (quantity == quantity.roundToDouble()) {
      return quantity.round().toString();
    }
    return quantity.toString();
  }

  void _initializeTaxAndTipFromBill(Bill bill) {
    final subtotal = bill.subtotalCents;
    if (bill.taxCents != null) {
      if (subtotal != null && subtotal > 0) {
        final percent = (bill.taxCents! / subtotal) * 100;
        _taxController.text = percent.toStringAsFixed(percent == percent.roundToDouble() ? 0 : 2);
        _taxInputMode = _AdjustmentInputMode.percent;
      } else {
        _taxController.text = (bill.taxCents! / 100).toStringAsFixed(2);
        _taxInputMode = _AdjustmentInputMode.amount;
      }
    }
    if (bill.tipCents != null) {
      if (subtotal != null && subtotal > 0 && bill.tipCents! > 0) {
        final percent = (bill.tipCents! / subtotal) * 100;
        _tipController.text = percent.toStringAsFixed(percent == percent.roundToDouble() ? 0 : 2);
        _tipInputMode = _AdjustmentInputMode.percent;
      } else {
        _tipController.text = (bill.tipCents! / 100).toStringAsFixed(2);
        _tipInputMode = _AdjustmentInputMode.amount;
      }
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _amountController.dispose();
    _taxController.dispose();
    _tipController.dispose();
    _titleFocusNode.dispose();
    _amountFocusNode.dispose();
    for (final row in _lineItemRows) {
      row.dispose();
    }
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

    final selectedIds = Set<String>.from(_selectedFriendIds);

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

  int get _subtotalCents =>
      _lineItemRows.fold<int>(0, (sum, row) => sum + row.lineTotalCents);

  int _adjustmentCents(String rawValue, _AdjustmentInputMode mode) {
    final cleaned = rawValue.trim().replaceAll(',', '');
    if (cleaned.isEmpty) return 0;
    final parsed = double.tryParse(cleaned);
    if (parsed == null || parsed < 0) return 0;
    if (mode == _AdjustmentInputMode.percent) {
      return (_subtotalCents * parsed / 100).round();
    }
    return (parsed * 100).round();
  }

  int get _taxCents => _adjustmentCents(_taxController.text, _taxInputMode);

  int get _tipCents => _adjustmentCents(_tipController.text, _tipInputMode);

  int? get _lineItemsFinalTotalCents {
    if (!_lineItemsEnabled) return null;
    final total = _subtotalCents + _taxCents + _tipCents;
    if (total <= 0) return null;
    return total;
  }

  int? get _totalCents {
    if (_lineItemsEnabled) {
      return _lineItemsFinalTotalCents;
    }
    final raw = _amountController.text.trim().replaceAll(',', '');
    if (raw.isEmpty) return null;
    final parsed = double.tryParse(raw);
    if (parsed == null || parsed <= 0) return null;
    return (parsed * 100).round();
  }

  void _toggleAmountSectionExpanded() {
    setState(() => _amountSectionExpanded = !_amountSectionExpanded);
  }

  void _setLineItemsEnabled(bool enabled) {
    if (_lineItemsEnabled == enabled) return;
    if (!enabled) {
      final total = _lineItemsFinalTotalCents;
      if (total != null && total > 0) {
        _amountController.text = (total / 100).toStringAsFixed(2);
      }
    }
    setState(() {
      _lineItemsEnabled = enabled;
      _amountError = null;
      if (enabled && _lineItemRows.isEmpty) {
        _lineItemRows = [_ManualLineItemRow()];
      }
    });
  }

  void _addLineItemRow() {
    setState(() {
      _lineItemRows = [..._lineItemRows, _ManualLineItemRow()];
    });
  }

  void _removeLineItemRow(int index) {
    if (_lineItemRows.length <= 1) {
      setState(() {
        _lineItemRows[index].quantityController.text = '1';
        _lineItemRows[index].titleController.clear();
        _lineItemRows[index].priceController.clear();
      });
      return;
    }
    setState(() {
      final row = _lineItemRows.removeAt(index);
      row.dispose();
    });
  }

  void _toggleTaxInputMode() {
    setState(() {
      _taxInputMode = _taxInputMode == _AdjustmentInputMode.percent
          ? _AdjustmentInputMode.amount
          : _AdjustmentInputMode.percent;
    });
  }

  void _toggleTipInputMode() {
    setState(() {
      _tipInputMode = _tipInputMode == _AdjustmentInputMode.percent
          ? _AdjustmentInputMode.amount
          : _AdjustmentInputMode.percent;
    });
  }

  int get _friendSplitTotalCents =>
      _splitEntries.fold<int>(0, (sum, entry) => sum + entry.shareCents);

  int? get _payerShareCents {
    final total = _totalCents;
    if (total == null) return null;
    return total - _friendSplitTotalCents;
  }

  bool get _canSavePayload {
    final title = _titleController.text.trim();
    final total = _totalCents;
    if (title.isEmpty || total == null) return false;
    if (_selectedFriendIds.isNotEmpty) {
      final payerShare = _payerShareCents;
      if (payerShare == null || payerShare < 0) return false;
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
    if (_lineItemsEnabled) {
      final hasValidItem = _lineItemRows.any((row) => row.lineTotalCents > 0);
      if (!hasValidItem) {
        return 'Add at least one line item with a price';
      }
      final total = _lineItemsFinalTotalCents;
      if (total == null || total <= 0) {
        return 'Enter a total greater than zero';
      }
      return null;
    }

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

    if (titleError == null && amountError == null && !_canSavePayload && _selectedFriendIds.isNotEmpty) {
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
    if (amountError != null && !_lineItemsEnabled) {
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
    final existingShares = {
      for (final participant in _participants) participant.id: _shareForUser(participant.id),
    };

    final selectedIds = selectedFriends.map((user) => user.id).toSet();
    final currentUserId = _currentUser.id;
    for (final userId in _splitAmountControllers.keys.toList()) {
      if (!selectedIds.contains(userId) && userId != currentUserId) {
        _splitAmountControllers.remove(userId)?.dispose();
      }
    }

    setState(() {
      _selectedFriendIds = selectedIds;
      var payerId = _selectedPayerId ?? currentUserId;
      if (payerId != currentUserId && !_selectedFriendIds.contains(payerId)) {
        payerId = currentUserId;
        _selectedPayerId = currentUserId;
      }
      final participants = [_currentUser, ...selectedFriends];
      _splitEntries = participants
          .where((user) => user.id != payerId)
          .map(
            (user) => ManualSplitEntry(
              user: user,
              shareCents: existingShares[user.id] ?? 0,
            ),
          )
          .toList();
      for (final entry in _splitEntries) {
        _controllerForUser(entry.user.id, initialCents: entry.shareCents).text =
            entry.shareCents == 0 ? '' : (entry.shareCents / 100).toStringAsFixed(2);
      }
    });
  }

  int _shareForUser(String userId) {
    final payerId = _selectedPayerId ?? _currentUser.id;
    if (userId == payerId) {
      return _payerShareCents ?? 0;
    }
    final index = _splitEntries.indexWhere((item) => item.user.id == userId);
    if (index < 0) return 0;
    return _splitEntries[index].shareCents;
  }

  bool get _areFriendAmountsEven {
    final payerId = _selectedPayerId ?? _currentUser.id;
    // Only compare editable friend rows (exclude the current payer).
    final friendAmounts = [
      for (final friend in _selectedFriendUsers)
        if (friend.id != payerId) _shareForUser(friend.id),
    ];
    // Need at least two friends with amounts; a single row is never "even".
    if (friendAmounts.length < 2) return false;
    final first = friendAmounts.first;
    // Initial all-zero state (and any zero) should not count as even.
    if (first <= 0) return false;
    return friendAmounts.every((amount) => amount == first);
  }

  void _splitEvenlyBetweenFriends() {
    final total = _totalCents;
    if (total == null || _selectedFriendIds.isEmpty) return;
    final participants = _participants;
    final baseShare = total ~/ participants.length;
    final remainder = total % participants.length;
    final shareById = <String, int>{};
    for (var i = 0; i < participants.length; i++) {
      shareById[participants[i].id] = baseShare + (i < remainder ? 1 : 0);
    }

    final payerId = _selectedPayerId ?? _currentUser.id;
    setState(() {
      _splitEntries = participants
          .where((participant) => participant.id != payerId)
          .map(
            (participant) => ManualSplitEntry(
              user: participant,
              shareCents: shareById[participant.id] ?? 0,
            ),
          )
          .toList();
      for (final entry in _splitEntries) {
        _controllerForUser(entry.user.id, initialCents: entry.shareCents).text =
            (entry.shareCents / 100).toStringAsFixed(2);
      }
      _error = null;
    });
  }

  void _setPayer(String payerId) {
    if (payerId == _selectedPayerId) return;
    final sharesById = {
      for (final participant in _participants) participant.id: _shareForUser(participant.id),
    };

    setState(() {
      _selectedPayerId = payerId;
      _splitEntries = _participants
          .where((participant) => participant.id != payerId)
          .map(
            (participant) => ManualSplitEntry(
              user: participant,
              shareCents: sharesById[participant.id] ?? 0,
            ),
          )
          .toList();
      for (final entry in _splitEntries) {
        _controllerForUser(entry.user.id, initialCents: entry.shareCents).text =
            entry.shareCents == 0 ? '' : (entry.shareCents / 100).toStringAsFixed(2);
      }
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
              const SizedBox(height: 8),
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
        _buildFinalAmountCard(),
        const SizedBox(height: 16),
        _buildSplitWithFriendsCard(),
      ],
    );
  }

  Widget _buildFinalAmountCard() {
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
            child: const Text(
              'Final Amount Paid',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.1,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 8),
                _lineItemsEnabled ? _buildComputedAmountDisplay() : _buildAmountField(),
                _buildFieldError(_amountError),
                const SizedBox(height: 12),
                _buildAmountSectionExpandTrigger(),
                AnimatedSize(
                  duration: const Duration(milliseconds: 280),
                  curve: Curves.easeOutCubic,
                  alignment: Alignment.topCenter,
                  clipBehavior: Clip.hardEdge,
                  child: _amountSectionExpanded
                      ? Padding(
                          padding: const EdgeInsets.only(top: 16),
                          child: _buildExpandedAmountSection(),
                        )
                      : const SizedBox(width: double.infinity),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAmountSectionExpandTrigger() {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: _toggleAmountSectionExpanded,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.fromLTRB(0, 16, 0, 16),
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.border, width: 1),
            borderRadius: BorderRadius.all(Radius.circular(12)),
          ),
          child: Row(
            children: [
              SizedBox(width: 12),
              AnimatedRotation(
                turns: _amountSectionExpanded ? 0.5 : 0,
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOutCubic,
                child: const Icon(
                  Icons.keyboard_arrow_down_rounded,
                  color: AppColors.text,
                  size: 22,
                ),
              ),
              const SizedBox(width: 4),
              const Expanded(
                child: Text(
                  'Line items - (optional)',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: AppColors.textH,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildExpandedAmountSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildLineItemModeSelector(),
        AnimatedSize(
          duration: const Duration(milliseconds: 280),
          curve: Curves.easeOutCubic,
          alignment: Alignment.topCenter,
          clipBehavior: Clip.hardEdge,
          child: _lineItemsEnabled
              ? Padding(
                  padding: const EdgeInsets.only(top: 16),
                  child: _buildLineItemsSection(),
                )
              : const SizedBox(width: double.infinity),
        ),
      ],
    );
  }

  Widget _buildLineItemModeSelector() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              'One main total',
              textAlign: TextAlign.left,
              style: TextStyle(
                fontWeight: !_lineItemsEnabled ? FontWeight.w800 : FontWeight.w500,
                fontSize: 13,
                color: !_lineItemsEnabled ? AppColors.textH : AppColors.text,
              ),
            ),
          ),
          Switch.adaptive(
            value: _lineItemsEnabled,
            activeTrackColor: AppColors.accent,
            onChanged: _setLineItemsEnabled,
          ),
          Expanded(
            child: Text(
              'Line item details',
              textAlign: TextAlign.right,
              style: TextStyle(
                fontWeight: _lineItemsEnabled ? FontWeight.w800 : FontWeight.w500,
                fontSize: 13,
                color: _lineItemsEnabled ? AppColors.textH : AppColors.text,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildComputedAmountDisplay() {
    const amountStyle = TextStyle(
      fontSize: 36,
      fontWeight: FontWeight.w800,
      color: AppColors.textH,
      letterSpacing: -0.5,
    );
    final total = _lineItemsFinalTotalCents;
    final hasError = _amountError != null;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOutCubic,
      decoration: BoxDecoration(
        color: hasError ? AppColors.errorBg : AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: hasError ? AppColors.error : AppColors.border,
          width: hasError ? 1.5 : 1,
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const Text(r'$ ', style: amountStyle),
          Expanded(
            child: Text(
              total == null ? '0.00' : (total / 100).toStringAsFixed(2),
              style: amountStyle,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLineItemsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ..._lineItemRows.asMap().entries.map(
              (entry) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _buildLineItemRow(entry.key),
              ),
            ),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: _addLineItemRow,
            icon: const Icon(Icons.add_rounded, size: 18),
            label: const Text('Add item'),
            style: TextButton.styleFrom(
              foregroundColor: AppColors.accent,
              textStyle: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ),
        const SizedBox(height: 4),
        _buildSummaryRow(label: 'Subtotal', valueCents: _subtotalCents),
        const SizedBox(height: 10),
        _buildAdjustmentRow(
          label: 'Tax',
          controller: _taxController,
          mode: _taxInputMode,
          onToggleMode: _toggleTaxInputMode,
        ),
        const SizedBox(height: 10),
        _buildAdjustmentRow(
          label: 'Tip',
          controller: _tipController,
          mode: _tipInputMode,
          onToggleMode: _toggleTipInputMode,
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: AppColors.accentSoft,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.accent.withValues(alpha: 0.25)),
          ),
          child: _buildSummaryRow(
            label: 'Final total',
            valueCents: _lineItemsFinalTotalCents ?? 0,
            emphasize: true,
          ),
        ),
        const SizedBox(height: 4),
      ],
    );
  }

  Widget _buildLineItemRow(int index) {
    final row = _lineItemRows[index];

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 52,
            child: TextField(
              controller: row.quantityController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
              ],
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.w700),
              decoration: _compactInputDecoration(hintText: '1'),
              onChanged: (_) {
                _clearAmountError();
                setState(() {});
              },
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: row.titleController,
              textCapitalization: TextCapitalization.sentences,
              style: const TextStyle(fontWeight: FontWeight.w600),
              decoration: _compactInputDecoration(hintText: 'Item name'),
              onChanged: (_) {
                _clearAmountError();
                setState(() {});
              },
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 92,
            child: TextField(
              controller: row.priceController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
              ],
              textAlign: TextAlign.right,
              style: const TextStyle(fontWeight: FontWeight.w700),
              decoration: _compactInputDecoration(hintText: '0.00', prefixText: r'$ '),
              onChanged: (_) {
                _clearAmountError();
                setState(() {});
              },
            ),
          ),
          if (_lineItemRows.length > 1 || row.hasContent) ...[
            const SizedBox(width: 4),
            IconButton(
              visualDensity: VisualDensity.compact,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
              onPressed: () => _removeLineItemRow(index),
              icon: Icon(
                Icons.close_rounded,
                size: 18,
                color: AppColors.text.withValues(alpha: 0.7),
              ),
            ),
          ],
        ],
      ),
    );
  }

  InputDecoration _compactInputDecoration({
    String? hintText,
    String? prefixText,
  }) {
    return InputDecoration(
      hintText: hintText,
      prefixText: prefixText,
      isDense: true,
      filled: true,
      fillColor: AppColors.surfaceMuted,
      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.accent, width: 1.5),
      ),
    );
  }

  Widget _buildSummaryRow({
    required String label,
    required int valueCents,
    bool emphasize = false,
  }) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              fontWeight: emphasize ? FontWeight.w800 : FontWeight.w600,
              fontSize: emphasize ? 15 : 14,
              color: emphasize ? AppColors.textH : AppColors.text,
            ),
          ),
        ),
        Text(
          formatCad(valueCents),
          style: TextStyle(
            fontWeight: emphasize ? FontWeight.w800 : FontWeight.w700,
            fontSize: emphasize ? 18 : 15,
            color: AppColors.textH,
          ),
        ),
      ],
    );
  }

  Widget _buildAdjustmentRow({
    required String label,
    required TextEditingController controller,
    required _AdjustmentInputMode mode,
    required VoidCallback onToggleMode,
  }) {
    final isPercent = mode == _AdjustmentInputMode.percent;

    return Row(
      children: [
        SizedBox(
          width: 42,
          child: Text(
            label,
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              color: AppColors.textH,
            ),
          ),
        ),
        Expanded(
          child: TextField(
            controller: controller,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
            ],
            style: const TextStyle(fontWeight: FontWeight.w600),
            decoration: _compactInputDecoration(
              hintText: isPercent ? '0' : '0.00',
              prefixText: isPercent ? null : r'$ ',
            ),
            onChanged: (_) {
              _clearAmountError();
              setState(() {});
            },
          ),
        ),
        if (isPercent)
          Padding(
            padding: const EdgeInsets.only(left: 6),
            child: Text(
              '%',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: AppColors.text.withValues(alpha: 0.75),
              ),
            ),
          ),
        const SizedBox(width: 8),
        _buildAdjustmentModeToggle(
          isPercentActive: isPercent,
          onTap: onToggleMode,
        ),
      ],
    );
  }

  Widget _buildAdjustmentModeToggle({
    required bool isPercentActive,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: AppColors.surfaceMuted,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildModeToggleIcon(
                icon: Icons.percent_rounded,
                active: isPercentActive,
              ),
              const SizedBox(width: 4),
              _buildModeToggleIcon(
                icon: Icons.attach_money_rounded,
                active: !isPercentActive,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildModeToggleIcon({
    required IconData icon,
    required bool active,
  }) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOutCubic,
      width: 30,
      height: 30,
      decoration: BoxDecoration(
        color: active ? AppColors.accent : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(
        icon,
        size: 18,
        color: active ? Colors.white : AppColors.accent,
      ),
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

  Widget _buildSplitWithFriendsCard() {
    final payerId = _selectedPayerId ?? _currentUser.id;
    final payerShare = _payerShareCents ?? 0;
    final orderedParticipants = [
      ..._participants.where((participant) => participant.id == payerId),
      ..._participants.where((participant) => participant.id != payerId),
    ];

    return _buildSectionCard(
      title: 'Split with Friends - (optional)',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 8),
          if (_selectedFriendIds.isNotEmpty) ...[
            _buildSplitEvenlyButton(),
            const SizedBox(height: 10),
            ...orderedParticipants.map(
              (participant) => _buildSplitParticipantRow(
                participant: participant,
                isPayer: participant.id == payerId,
                payerShareCents: payerShare,
              ),
            ),
            const SizedBox(height: 8),
            SecondaryButton(
              label: 'Edit friends',
              onPressed: _openFriendPicker,
            ),
          ] else
            SecondaryButton(
              label: 'Add friends',
              onPressed: _openFriendPicker,
            ),
        ],
      ),
    );
  }

  Widget _buildSplitEvenlyButton() {
    final isActive = _areFriendAmountsEven;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: _splitEvenlyBetweenFriends,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.surfaceMuted,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isActive ? AppColors.accent : AppColors.border,
              width: isActive ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              SizedBox(
                width: 20,
                child: isActive
                    ? const Icon(
                        Icons.check_rounded,
                        size: 16,
                        color: AppColors.accent,
                      )
                    : const SizedBox.shrink(),
              ),
              Expanded(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    Icon(Icons.balance_rounded, size: 16, color: AppColors.textH),
                    SizedBox(width: 6),
                    Text(
                      'Split evenly between friends',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: AppColors.textH,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSplitParticipantRow({
    required User participant,
    required bool isPayer,
    required int payerShareCents,
  }) {
    if (isPayer) {
      return Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          gradient: AppColors.brandGradient,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text.rich(
                TextSpan(
                  children: [
                    const TextSpan(
                      text: 'Paid by: ',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    TextSpan(
                      text: participant.id == _currentUser.id
                          ? 'You'
                          : displayName(participant),
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Text(
              formatCad(payerShareCents.clamp(0, payerShareCents < 0 ? 0 : payerShareCents)),
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: 18,
              ),
            ),
          ],
        ),
      );
    }

    final entryIndex = _splitEntries.indexWhere((entry) => entry.user.id == participant.id);
    final entry = entryIndex >= 0
        ? _splitEntries[entryIndex]
        : ManualSplitEntry(user: participant, shareCents: 0);
    final controller = _controllerForUser(participant.id, initialCents: entry.shareCents);

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
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  participant.id == _currentUser.id ? 'You' : displayName(participant),
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                TextButton(
                  onPressed: () => _setPayer(participant.id),
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: const Size(0, 0),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    foregroundColor: AppColors.accent,
                    textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
                  ),
                  child: const Text('Mark as initial payer'),
                ),
              ],
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
              onChanged: (value) => _syncSplitEntry(participant.id, value),
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

    final basePayload = <String, dynamic>{
      'description': description,
      'totalCents': total,
      'source': bill?.source.name ?? 'manual',
    };

    if (_lineItemsEnabled) {
      basePayload.addAll({
        'subtotalCents': _subtotalCents,
        'taxCents': _taxCents,
        'tipCents': _tipCents,
        'itemCount': _lineItemRows.where((row) => row.lineTotalCents > 0).length,
        'lineItems': _lineItemRows
            .where((row) => row.lineTotalCents > 0)
            .toList()
            .asMap()
            .entries
            .map((entry) {
              final row = entry.value;
              final quantity = double.tryParse(row.quantityController.text.trim()) ?? 1;
              final unitPrice = double.tryParse(
                    row.priceController.text.trim().replaceAll(',', ''),
                  ) ??
                  0;
              final unitPriceCents = (unitPrice * 100).round();
              return {
                'name': row.titleController.text.trim().isEmpty
                    ? 'Item ${entry.key + 1}'
                    : row.titleController.text.trim(),
                'quantity': quantity,
                'unitPriceCents': unitPriceCents,
                'totalPriceCents': row.lineTotalCents,
                'assignedUserIds': const <String>[],
              };
            })
            .toList(),
      });
    }

    if (_selectedFriendIds.isEmpty) {
      return basePayload;
    }

    final currentUser = _currentUser;
    final payerId = _selectedPayerId ?? currentUser.id;
    final participantIds = [currentUser.id, ..._selectedFriendUsers.map((friend) => friend.id)];
    final payerShare = _payerShareCents!;
    final sharesByUserId = {
      for (final participantId in participantIds) participantId: _shareForUser(participantId),
    };

    return {
      ...basePayload,
      'participantIds': participantIds,
      'payerId': payerId,
      'shares': participantIds
          .map(
            (userId) => {
              'userId': userId,
              'shareCents': userId == payerId ? payerShare : (sharesByUserId[userId] ?? 0),
            },
          )
          .toList(),
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
