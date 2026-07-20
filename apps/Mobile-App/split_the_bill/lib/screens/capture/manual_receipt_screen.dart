import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../api/api_exception.dart';
import '../../models/models.dart';
import '../../models/receipt.dart';
import '../../models/user.dart';
import '../../providers/providers.dart';
import '../../services/ai_receipt_consent_storage.dart';
import '../../theme/app_colors.dart';
import '../../utils/capture_bill_split.dart';
import '../../utils/even_split.dart';
import '../../utils/format.dart';
import '../../utils/manual_receipt_prefill.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/modals/ai_receipt_consent_dialog.dart';
import '../../widgets/segmented_toggle.dart';

class ManualSplitEntry {
  const ManualSplitEntry({required this.user, required this.shareCents});

  final User user;
  final int shareCents;
}

enum _AdjustmentInputMode { percent, amount }

enum _SplitMode { splitTotal, splitByLineItem }

enum _SplitTarget { solo, friends, group }

enum _ConsentResult { granted, cancelled, failed }

class _ManualLineItemRow {
  _ManualLineItemRow({
    String quantity = '1',
    String title = '',
    String price = '',
  }) : quantityController = TextEditingController(text: quantity),
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
    final price =
        double.tryParse(priceController.text.trim().replaceAll(',', '')) ?? 0;
    if (qty <= 0 || price < 0) return 0;
    return (qty * price * 100).round();
  }

  bool get hasContent =>
      titleController.text.trim().isNotEmpty ||
      priceController.text.trim().isNotEmpty ||
      quantityController.text.trim() != '1';
}

class _LineItemSelectionOption {
  const _LineItemSelectionOption({
    required this.sourceIndex,
    required this.title,
    required this.totalCents,
  });

  final int sourceIndex;
  final String title;
  final int totalCents;
}

class ManualReceiptScreen extends ConsumerStatefulWidget {
  const ManualReceiptScreen({
    super.key,
    this.initialBill,
    this.imageBytes,
    this.initialGroupId,
  });

  final Bill? initialBill;
  final List<int>? imageBytes;
  final String? initialGroupId;

  @override
  ConsumerState<ManualReceiptScreen> createState() =>
      _ManualReceiptScreenState();
}

class _ManualReceiptScreenState extends ConsumerState<ManualReceiptScreen> {
  final _titleController = TextEditingController();
  final _amountController = TextEditingController();
  final _taxController = TextEditingController(text: '13');
  final _tipController = TextEditingController(text: '0');
  final _otherFeesController = TextEditingController(text: '0.00');
  final _storeNameController = TextEditingController();
  final _storeAddressController = TextEditingController();
  final _receiptNumberController = TextEditingController();
  final _receiptDateController = TextEditingController();
  final _receiptTimeController = TextEditingController();
  final _paymentMethodController = TextEditingController();
  final _cardLast4Controller = TextEditingController();
  final _splitAmountControllers = <String, TextEditingController>{};
  final _titleFocusNode = FocusNode();
  final _amountFocusNode = FocusNode();

  List<User> _friends = [];
  List<GroupSummary> _groups = [];
  List<ManualSplitEntry> _splitEntries = [];
  List<_ManualLineItemRow> _lineItemRows = [];
  Set<String> _selectedFriendIds = <String>{};
  String? _selectedGroupId;
  GroupDetail? _selectedGroupDetail;
  _SplitTarget _splitTarget = _SplitTarget.solo;
  String? _selectedPayerId;
  bool _amountSectionExpanded = false;
  bool _lineItemsEnabled = false;
  _SplitMode _splitMode = _SplitMode.splitTotal;
  bool _additionalDetailsExpanded = false;
  bool _loadingFriends = true;
  bool _saving = false;
  _AdjustmentInputMode _taxInputMode = _AdjustmentInputMode.percent;
  _AdjustmentInputMode _tipInputMode = _AdjustmentInputMode.percent;
  Map<int, Set<String>> _lineItemAssignments = <int, Set<String>>{};
  BillSource _billSource = BillSource.manual;
  DateTime? _incurredAt;
  bool _parsing = false;
  bool _awaitingConsent = false;
  String? _error;
  String? _titleError;
  String? _amountError;
  List<int>? _imageBytes;

  @override
  void initState() {
    super.initState();
    _imageBytes = widget.imageBytes;
    final currentUser = ref.read(authProvider).user;
    final bill = widget.initialBill;
    if (bill != null) {
      _applyPrefill(prefillFromBill(bill, currentUser!));
      if (bill.isSplitWithGroup && bill.groupId != null) {
        _splitTarget = _SplitTarget.group;
        _selectedGroupId = bill.groupId;
      } else if (bill.isSplitWithFriends) {
        _splitTarget = _SplitTarget.friends;
      } else {
        _splitTarget = _SplitTarget.solo;
      }
    } else {
      _selectedPayerId = currentUser?.id;
      if (widget.initialGroupId != null) {
        _splitTarget = _SplitTarget.group;
        _selectedGroupId = widget.initialGroupId;
      }
      if (_imageBytes != null) {
        _awaitingConsent = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          _parseReceipt();
        });
      }
    }
    if (_lineItemRows.isEmpty && _lineItemsEnabled) {
      _lineItemRows = [_ManualLineItemRow()];
    }
    _loadFriends();
    _loadGroups();
  }

  Future<void> _loadGroups() async {
    try {
      final groups = await ref.read(groupsApiProvider).listGroups();
      if (!mounted) return;
      setState(() => _groups = groups);
      if (_selectedGroupId != null) {
        await _loadSelectedGroupDetail(_selectedGroupId!);
      }
    } catch (_) {
      // Groups are optional for manual bill entry.
    }
  }

  Future<void> _loadSelectedGroupDetail(String groupId) async {
    try {
      final detail = await ref.read(groupsApiProvider).getGroup(groupId);
      if (!mounted) return;
      setState(() => _selectedGroupDetail = detail);
    } catch (_) {
      if (mounted) setState(() => _selectedGroupDetail = null);
    }
  }

  void _setSplitTarget(_SplitTarget target) {
    setState(() {
      _splitTarget = target;
      _error = null;
      if (target == _SplitTarget.solo) {
        _selectedFriendIds = {};
        _selectedGroupId = null;
        _selectedGroupDetail = null;
        _splitMode = _SplitMode.splitTotal;
      } else if (target == _SplitTarget.friends) {
        _selectedGroupId = null;
        _selectedGroupDetail = null;
      } else {
        _selectedFriendIds = {};
        _lineItemAssignments = {};
        _splitMode = _SplitMode.splitTotal;
        _selectedPayerId = _currentUser.id;
        if (_selectedGroupId == null && _groups.isNotEmpty) {
          _selectedGroupId = _groups.first.id;
          _loadSelectedGroupDetail(_groups.first.id);
        }
      }
    });
  }

  void _applyPrefill(ManualReceiptPrefill prefill) {
    _titleController.text = prefill.title;
    _amountController.text = prefill.amount;
    _storeNameController.text = prefill.storeName;
    _storeAddressController.text = prefill.storeAddress;
    _receiptNumberController.text = prefill.receiptNumber;
    _receiptDateController.text = prefill.receiptDate;
    _receiptTimeController.text = prefill.receiptTime;
    _paymentMethodController.text = prefill.paymentMethod;
    _cardLast4Controller.text = prefill.cardLast4;
    _taxController.text = prefill.taxValue;
    _tipController.text = prefill.tipValue;
    _otherFeesController.text =
        (prefill.otherFeesCents / 100).toStringAsFixed(2);
    _taxInputMode = prefill.taxInputMode == ManualReceiptAdjustmentMode.percent
        ? _AdjustmentInputMode.percent
        : _AdjustmentInputMode.amount;
    _tipInputMode = prefill.tipInputMode == ManualReceiptAdjustmentMode.percent
        ? _AdjustmentInputMode.percent
        : _AdjustmentInputMode.amount;
    _selectedPayerId = prefill.payerId;
    _selectedFriendIds = Set<String>.from(prefill.selectedFriendIds);
    _splitEntries = prefill.splitEntries
        .map(
          (entry) => ManualSplitEntry(
            user: entry.user,
            shareCents: entry.shareCents,
          ),
        )
        .toList();
    _lineItemsEnabled = prefill.lineItemsEnabled;
    _splitMode = prefill.splitMode == ManualReceiptSplitMode.splitByLineItem
        ? _SplitMode.splitByLineItem
        : _SplitMode.splitTotal;
    _lineItemRows = prefill.lineItems
        .map(
          (item) => _ManualLineItemRow(
            quantity: item.quantity,
            title: item.title,
            price: item.price,
          ),
        )
        .toList();
    _lineItemAssignments = {
      for (final entry in prefill.lineItemAssignments.entries)
        entry.key: Set<String>.from(entry.value),
    };
    _incurredAt = prefill.incurredAt;
    _billSource = prefill.billSource;
  }

  Future<void> _parseReceipt() async {
    final bytes = _imageBytes;
    if (bytes == null) return;

    final consent = await _ensureAiReceiptConsent();
    if (!mounted) return;
    if (consent == _ConsentResult.cancelled) {
      if (context.canPop()) {
        context.pop();
      }
      return;
    }
    if (consent == _ConsentResult.failed) {
      setState(() => _awaitingConsent = false);
      return;
    }

    setState(() {
      _awaitingConsent = false;
      _parsing = true;
      _error = null;
    });

    try {
      final receipt = await ref
          .read(receiptsApiProvider)
          .parseReceipt(Uint8List.fromList(bytes), 'receipt.jpg');
      if (!mounted) return;
      setState(() {
        _applyPrefill(prefillFromParsedReceipt(receipt));
        _selectedPayerId ??= ref.read(authProvider).user?.id;
        _parsing = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = apiErrorMessage(e, 'Unable to parse receipt.');
        _selectedPayerId ??= ref.read(authProvider).user?.id;
        _parsing = false;
      });
    }
  }

  /// Ensures the user has consented before uploading the receipt image.
  Future<_ConsentResult> _ensureAiReceiptConsent() async {
    final user = ref.read(authProvider).user;
    if (user == null) return _ConsentResult.cancelled;

    final storage = AiReceiptConsentStorage();
    try {
      if (await storage.hasConsent(user.id)) {
        return _ConsentResult.granted;
      }
    } catch (_) {
      // Fall through to DB / dialog if local prefs are unavailable.
    }

    if (user.hasAiReceiptConsent) {
      try {
        await storage.setConsent(user.id);
      } catch (_) {}
      return _ConsentResult.granted;
    }

    if (!mounted) return _ConsentResult.cancelled;
    final confirmed = await showAiReceiptConsentDialog(context);
    if (confirmed != true) return _ConsentResult.cancelled;

    try {
      await ref.read(authProvider.notifier).recordAiReceiptConsent();
      try {
        await storage.setConsent(user.id);
      } catch (_) {}
      return _ConsentResult.granted;
    } catch (_) {
      if (!mounted) return _ConsentResult.failed;
      setState(() {
        _error = 'Unable to save AI receipt consent. Please try again.';
      });
      return _ConsentResult.failed;
    }
  }

  User get _currentUser {
    final user = ref.read(authProvider).user;
    if (user == null) {
      throw StateError('Current user not available.');
    }
    return user;
  }

  List<User> get _selectedFriendUsers {
    final selected = _friends
        .where((friend) => _selectedFriendIds.contains(friend.id))
        .toList();
    selected.sort((a, b) => displayName(a).compareTo(displayName(b)));
    return selected;
  }

  List<User> get _participants {
    if (_splitTarget == _SplitTarget.group) {
      final members = _selectedGroupDetail?.members ?? const [];
      return members.map((member) => member.user).toList();
    }
    return [_currentUser, ..._selectedFriendUsers];
  }

  bool get _isGroupSplit => _splitTarget == _SplitTarget.group && _selectedGroupId != null;

  bool get _isSplitWithAnyone =>
      _splitTarget == _SplitTarget.friends && _selectedFriendIds.isNotEmpty ||
      _isGroupSplit;

  String? _nullableTrim(TextEditingController controller) {
    final value = controller.text.trim();
    return value.isEmpty ? null : value;
  }

  Set<String> get _activeParticipantIds {
    if (_isGroupSplit) {
      return _participants.map((participant) => participant.id).toSet();
    }
    return {_currentUser.id, ..._selectedFriendIds};
  }

  bool get _isSplitByLineItemMode {
    return !_isGroupSplit &&
        _lineItemsEnabled &&
        _splitMode == _SplitMode.splitByLineItem;
  }

  List<({int sourceIndex, _ManualLineItemRow row})>
  get _splittableLineItemEntries {
    return _lineItemRows
        .asMap()
        .entries
        .where((entry) => entry.value.lineTotalCents > 0)
        .map((entry) {
          return (sourceIndex: entry.key, row: entry.value);
        })
        .toList();
  }

  void _normalizeLineItemAssignments() {
    final validIndices = _lineItemRows.asMap().keys.toSet();
    final validUserIds = _activeParticipantIds;
    _lineItemAssignments = {
      for (final entry in _lineItemAssignments.entries)
        if (validIndices.contains(entry.key))
          entry.key: entry.value.where(validUserIds.contains).toSet(),
    };
  }

  void _reindexLineItemAssignmentsAfterRemoval(int removedIndex) {
    final updated = <int, Set<String>>{};
    for (final entry in _lineItemAssignments.entries) {
      if (entry.key == removedIndex) continue;
      final nextIndex = entry.key > removedIndex ? entry.key - 1 : entry.key;
      updated[nextIndex] = {...entry.value};
    }
    _lineItemAssignments = updated;
  }

  bool get _lineItemAssignmentsComplete {
    final validUserIds = _activeParticipantIds;
    final splittableEntries = _splittableLineItemEntries;
    if (splittableEntries.isEmpty) return false;
    for (final entry in splittableEntries) {
      final assigned =
          _lineItemAssignments[entry.sourceIndex]
              ?.where(validUserIds.contains)
              .toSet() ??
          <String>{};
      if (assigned.isEmpty) return false;
    }
    return true;
  }

  String _lineItemDisplayName(_ManualLineItemRow row, int sourceIndex) {
    final title = row.titleController.text.trim();
    if (title.isNotEmpty) return title;
    return 'Item ${sourceIndex + 1}';
  }

  DateTime _resolvedIncurredAt() {
    if (_incurredAt != null) return _incurredAt!;
    final date = _receiptDateController.text.trim();
    if (date.isNotEmpty) {
      final time = _receiptTimeController.text.trim();
      final parsed = DateTime.tryParse(time.isEmpty ? date : '$date $time');
      if (parsed != null) return parsed;
    }
    return DateTime.now();
  }

  String _resolvedIncurredAtIso() {
    final date = _resolvedIncurredAt();
    return incurredAtIso(date);
  }

  @override
  void dispose() {
    _titleController.dispose();
    _amountController.dispose();
    _taxController.dispose();
    _tipController.dispose();
    _otherFeesController.dispose();
    _storeNameController.dispose();
    _storeAddressController.dispose();
    _receiptNumberController.dispose();
    _receiptDateController.dispose();
    _receiptTimeController.dispose();
    _paymentMethodController.dispose();
    _cardLast4Controller.dispose();
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

  int get _otherFeesCents =>
      _adjustmentCents(_otherFeesController.text, _AdjustmentInputMode.amount);

  int? get _lineItemsFinalTotalCents {
    if (!_lineItemsEnabled) return null;
    final total = _subtotalCents + _taxCents + _tipCents + _otherFeesCents;
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
      if (!enabled) {
        _amountSectionExpanded = false;
        _splitMode = _SplitMode.splitTotal;
      }
      if (enabled && _lineItemRows.isEmpty) {
        _lineItemRows = [_ManualLineItemRow()];
      }
      _normalizeLineItemAssignments();
    });
  }

  void _addLineItemRow() {
    setState(() {
      _lineItemRows = [..._lineItemRows, _ManualLineItemRow()];
      _normalizeLineItemAssignments();
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
      _reindexLineItemAssignmentsAfterRemoval(index);
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
    if (_isGroupSplit) {
      return _selectedGroupId != null &&
          (_selectedGroupDetail?.members.length ?? 0) >= 2;
    }
    if (_selectedFriendIds.isNotEmpty) {
      if (_isSplitByLineItemMode) {
        return _lineItemAssignmentsComplete;
      }
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

    if (titleError == null &&
        amountError == null &&
        !_canSavePayload &&
        _splitTarget == _SplitTarget.friends &&
        _selectedFriendIds.isNotEmpty) {
      splitError = _isSplitByLineItemMode
          ? 'Assign each line item to at least one participant.'
          : 'Adjust friend amounts so they add up to the total.';
    }

    if (titleError == null &&
        amountError == null &&
        !_canSavePayload &&
        _isGroupSplit) {
      splitError = 'Group bills require at least two members.';
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
    final user = _splitEntries
        .firstWhere((entry) => entry.user.id == userId)
        .user;
    final existingIndex = _splitEntries.indexWhere(
      (entry) => entry.user.id == userId,
    );

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
      for (final participant in _participants)
        participant.id: _shareForUser(participant.id),
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
        _controllerForUser(
          entry.user.id,
          initialCents: entry.shareCents,
        ).text = entry.shareCents == 0
            ? ''
            : (entry.shareCents / 100).toStringAsFixed(2);
      }
      _normalizeLineItemAssignments();
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
    return areShareAmountsEvenlySplit(
      [for (final participant in _participants) _shareForUser(participant.id)],
    );
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

    if (_splitTarget == _SplitTarget.group) {
      setState(() => _selectedPayerId = payerId);
      return;
    }

    final sharesById = {
      for (final participant in _participants)
        participant.id: _shareForUser(participant.id),
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
        _controllerForUser(
          entry.user.id,
          initialCents: entry.shareCents,
        ).text = entry.shareCents == 0
            ? ''
            : (entry.shareCents / 100).toStringAsFixed(2);
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

  Widget _buildSectionCard({required String title, required Widget child}) {
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
            decoration: const BoxDecoration(gradient: AppColors.brandGradient),
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
        _buildSplitTargetCard(),
        const SizedBox(height: 16),
        _buildAdditionalDetailsCard(),
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
            decoration: const BoxDecoration(gradient: AppColors.brandGradient),
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
                _lineItemsEnabled
                    ? _buildComputedAmountDisplay()
                    : _buildAmountField(),
                _buildFieldError(_amountError),
                const SizedBox(height: 12),
                _buildLineItemModeSelector(),
                AnimatedSize(
                  duration: const Duration(milliseconds: 280),
                  curve: Curves.easeOutCubic,
                  alignment: Alignment.topCenter,
                  clipBehavior: Clip.hardEdge,
                  child: _lineItemsEnabled
                      ? Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              _buildAmountSectionExpandTrigger(),
                              AnimatedSize(
                                duration: const Duration(milliseconds: 280),
                                curve: Curves.easeOutCubic,
                                alignment: Alignment.topCenter,
                                clipBehavior: Clip.hardEdge,
                                child: _amountSectionExpanded
                                    ? Padding(
                                        padding: const EdgeInsets.only(top: 16),
                                        child: _buildLineItemsSection(),
                                      )
                                    : const SizedBox(width: double.infinity),
                              ),
                            ],
                          ),
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
              Expanded(
                child: Text(
                  'Line items - ${_lineItemRows.length}',
                  style: const TextStyle(
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

  Widget _buildLineItemModeSelector() {
    const items = [
      SegmentedToggleItem(
        label: 'One main total',
        icon: Icons.payments_outlined,
      ),
      SegmentedToggleItem(
        label: 'Line item details',
        icon: Icons.receipt_long_outlined,
      ),
    ];

    return SegmentedToggle(
      items: items,
      selectedIndex: _lineItemsEnabled ? 1 : 0,
      onSelected: (index) => _setLineItemsEnabled(index == 1),
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
        const SizedBox(height: 10),
        _buildAdjustmentRow(
          label: 'Fees',
          controller: _otherFeesController,
          mode: _AdjustmentInputMode.amount,
          onToggleMode: null,
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
    final showRemove = _lineItemRows.length > 1 || row.hasContent;

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
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
              if (showRemove) ...[
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
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SizedBox(
                width: 72,
                child: TextField(
                  controller: row.quantityController,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
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
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text(
                  '×',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w600,
                    height: 1,
                    color: AppColors.text.withValues(alpha: 0.45),
                  ),
                ),
              ),
              Expanded(
                child: TextField(
                  controller: row.priceController,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
                  ],
                  textAlign: TextAlign.right,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                  decoration: _compactInputDecoration(
                    hintText: '0.00',
                    prefixText: r'$ ',
                  ),
                  onChanged: (_) {
                    _clearAmountError();
                    setState(() {});
                  },
                ),
              ),
            ],
          ),
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
    VoidCallback? onToggleMode,
  }) {
    final isPercent = mode == _AdjustmentInputMode.percent;
    final showModeToggle = onToggleMode != null;

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
        if (showModeToggle) ...[
          const SizedBox(width: 8),
          _buildAdjustmentModeToggle(
            isPercentActive: isPercent,
            onTap: onToggleMode,
          ),
        ],
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

  Widget _buildModeToggleIcon({required IconData icon, required bool active}) {
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
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(
                      RegExp(r'^\d*\.?\d{0,2}'),
                    ),
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

  Widget _buildSplitTargetCard() {
    return _buildSectionCard(
      title: 'Split with',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 8),
          SegmentedToggle(
            items: const [
              SegmentedToggleItem(label: 'Just me'),
              SegmentedToggleItem(label: 'Friends'),
              SegmentedToggleItem(label: 'Group'),
            ],
            selectedIndex: _splitTarget.index,
            onSelected: (index) => _setSplitTarget(_SplitTarget.values[index]),
          ),
          const SizedBox(height: 16),
          if (_splitTarget == _SplitTarget.friends) _buildFriendsSplitSection(),
          if (_splitTarget == _SplitTarget.group) _buildGroupSplitSection(),
        ],
      ),
    );
  }

  Widget _buildGroupSplitSection() {
    if (_groups.isEmpty) {
      return const Text(
        'Create a group first to split with one.',
        style: TextStyle(color: AppColors.text),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DropdownButtonFormField<String>(
          initialValue: _selectedGroupId,
          decoration: _boxedInputDecoration(hintText: 'Select group'),
          items: _groups
              .map(
                (group) => DropdownMenuItem(
                  value: group.id,
                  child: Text(group.name),
                ),
              )
              .toList(),
          onChanged: (groupId) {
            if (groupId == null) return;
            setState(() {
              _selectedGroupId = groupId;
              _selectedPayerId = _currentUser.id;
            });
            _loadSelectedGroupDetail(groupId);
          },
        ),
        if (_selectedGroupDetail != null) ...[
          const SizedBox(height: 12),
          Text(
            'Split evenly among ${_selectedGroupDetail!.members.length} members',
            style: const TextStyle(
              color: AppColors.text,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Tap who paid for this expense',
            style: TextStyle(color: AppColors.text, fontSize: 13),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _selectedGroupDetail!.members
                .map(_buildGroupMemberPayerChip)
                .toList(),
          ),
        ],
      ],
    );
  }

  Widget _buildGroupMemberPayerChip(GroupMemberDetail member) {
    final payerId = _selectedPayerId ?? _currentUser.id;
    final isPayer = member.user.id == payerId;
    final label = member.user.id == _currentUser.id
        ? 'You'
        : displayName(member.user);

    return FilterChip(
      label: Text(isPayer ? '$label · paid' : label),
      selected: isPayer,
      showCheckmark: false,
      onSelected: (_) => _setPayer(member.user.id),
      selectedColor: AppColors.accentSoft,
      backgroundColor: AppColors.surface,
      labelStyle: TextStyle(
        color: isPayer ? AppColors.accent : AppColors.textH,
        fontWeight: isPayer ? FontWeight.w700 : FontWeight.w600,
      ),
      side: BorderSide(
        color: isPayer ? AppColors.accent : AppColors.border,
        width: isPayer ? 2 : 1,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    );
  }

  Widget _buildFriendsSplitSection() {
    final payerId = _selectedPayerId ?? _currentUser.id;
    final payerShare = _payerShareCents ?? 0;
    final orderedParticipants = [
      ..._participants.where((participant) => participant.id == payerId),
      ..._participants.where((participant) => participant.id != payerId),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AnimatedSize(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOutCubic,
          alignment: Alignment.topCenter,
          clipBehavior: Clip.hardEdge,
          child: _lineItemsEnabled && _selectedFriendIds.isNotEmpty
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _buildSplitModeToggle(),
                    const SizedBox(height: 12),
                  ],
                )
              : const SizedBox.shrink(),
        ),
        if (_selectedFriendIds.isNotEmpty) ...[
          if (_isSplitByLineItemMode)
            _buildSplitByLineItemSection(participants: orderedParticipants)
          else
            _buildSplitTotalSection(
              participants: orderedParticipants,
              payerId: payerId,
              payerShareCents: payerShare,
            ),
          const SizedBox(height: 8),
          SecondaryButton(
            label: 'Edit friends',
            onPressed: _openFriendPicker,
          ),
        ] else
          SecondaryButton(label: 'Add friends', onPressed: _openFriendPicker),
      ],
    );
  }

  Widget _buildAdditionalDetailsCard() {
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
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          16,
          20,
          _additionalDetailsExpanded ? 20 : 16,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildAdditionalDetailsExpandTrigger(),
            AnimatedSize(
              duration: const Duration(milliseconds: 260),
              curve: Curves.easeOutCubic,
              alignment: Alignment.topCenter,
              clipBehavior: Clip.hardEdge,
              child: _additionalDetailsExpanded
                  ? Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: _buildAdditionalDetailsFields(),
                    )
                  : const SizedBox(width: double.infinity),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAdditionalDetailsExpandTrigger() {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          setState(
            () => _additionalDetailsExpanded = !_additionalDetailsExpanded,
          );
        },
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.border, width: 1),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              AnimatedRotation(
                turns: _additionalDetailsExpanded ? 0.5 : 0,
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
                  'Additional Details',
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

  Widget _buildAdditionalDetailsFields() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildAdditionalDetailsInput(
          label: 'Store',
          controller: _storeNameController,
          hintText: 'Enter store name',
        ),
        const SizedBox(height: 10),
        _buildAdditionalDetailsInput(
          label: 'Address',
          controller: _storeAddressController,
          hintText: 'Enter store address',
        ),
        const SizedBox(height: 10),
        _buildAdditionalDetailsInput(
          label: 'Receipt #',
          controller: _receiptNumberController,
          hintText: 'Enter receipt number',
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _buildAdditionalDetailsInput(
                label: 'Date',
                controller: _receiptDateController,
                hintText: 'YYYY-MM-DD',
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildAdditionalDetailsInput(
                label: 'Time',
                controller: _receiptTimeController,
                hintText: 'HH:MM',
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              flex: 3,
              child: _buildAdditionalDetailsInput(
                label: 'Payment',
                controller: _paymentMethodController,
                hintText: 'Enter payment method',
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: _buildAdditionalDetailsInput(
                label: 'Card Last 4',
                controller: _cardLast4Controller,
                hintText: 'Last 4 digits',
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildAdditionalDetailsInput({
    required String label,
    required TextEditingController controller,
    required String hintText,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: AppColors.text,
            fontWeight: FontWeight.w600,
            fontSize: 12,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          style: const TextStyle(
            color: AppColors.textH,
            fontWeight: FontWeight.w600,
          ),
          decoration: _boxedInputDecoration(hintText: hintText),
          onChanged: (_) => setState(() {}),
        ),
      ],
    );
  }

  Widget _buildSplitModeToggle() {
    const items = [
      SegmentedToggleItem(label: 'Split total', icon: Icons.functions_rounded),
      SegmentedToggleItem(
        label: 'Split by line item',
        icon: Icons.receipt_long_outlined,
      ),
    ];

    return SegmentedToggle(
      items: items,
      selectedIndex: _splitMode == _SplitMode.splitByLineItem ? 1 : 0,
      onSelected: (index) {
        setState(() {
          _splitMode = index == 1
              ? _SplitMode.splitByLineItem
              : _SplitMode.splitTotal;
          _error = null;
        });
      },
    );
  }

  Widget _buildSplitTotalSection({
    required List<User> participants,
    required String payerId,
    required int payerShareCents,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildSplitEvenlyButton(),
        const SizedBox(height: 12),
        const Divider(height: 1, color: AppColors.border),
        const SizedBox(height: 12),
        ...participants.map(
          (participant) => _buildSplitParticipantRow(
            participant: participant,
            isPayer: participant.id == payerId,
            payerShareCents: payerShareCents,
          ),
        ),
      ],
    );
  }

  Widget _buildSplitByLineItemSection({required List<User> participants}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_splittableLineItemEntries.isEmpty)
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.surfaceMuted,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: const Text(
              'Add line items in the section above.',
              style: TextStyle(
                color: AppColors.text,
                fontWeight: FontWeight.w600,
              ),
            ),
          )
        else ...[
          const Padding(
            padding: EdgeInsets.only(bottom: 10),
            child: Text(
              'Assign each line item to one or more participants.',
              style: TextStyle(
                color: AppColors.text,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          ...participants.map(_buildLineItemAssignmentParticipantRow),
        ],
      ],
    );
  }

  Widget _buildLineItemAssignmentParticipantRow(User participant) {
    final payerId = _selectedPayerId ?? _currentUser.id;
    final isPayer = participant.id == payerId;
    final assignedEntries = _splittableLineItemEntries
        .where(
          (entry) =>
              (_lineItemAssignments[entry.sourceIndex] ?? const <String>{})
                  .contains(participant.id),
        )
        .toList();
    final summary = assignedEntries.isEmpty
        ? 'No line items assigned'
        : '${assignedEntries.length} item${assignedEntries.length == 1 ? '' : 's'} assigned';

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
                  participant.id == _currentUser.id
                      ? 'You'
                      : displayName(participant),
                  style: const TextStyle(
                    color: AppColors.textH,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  summary,
                  style: const TextStyle(
                    color: AppColors.text,
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                ),
                if (assignedEntries.isNotEmpty) ...[
                  const SizedBox(height: 5),
                  Text(
                    assignedEntries
                        .take(2)
                        .map(
                          (entry) => _lineItemDisplayName(
                            entry.row,
                            entry.sourceIndex,
                          ),
                        )
                        .join(' • '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppColors.text, fontSize: 12),
                  ),
                ],
                const SizedBox(height: 4),
                if (isPayer)
                  const Text(
                    'Initial payer',
                    style: TextStyle(
                      color: AppColors.accent,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  )
                else
                  TextButton(
                    onPressed: () => _setPayer(participant.id),
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      minimumSize: const Size(0, 0),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      foregroundColor: AppColors.accent,
                      textStyle: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                      ),
                    ),
                    child: const Text('Mark as initial payer'),
                  ),
              ],
            ),
          ),
          IconButton(
            onPressed: _splittableLineItemEntries.isEmpty
                ? null
                : () => _openLineItemPicker(participant),
            style: IconButton.styleFrom(
              backgroundColor: AppColors.surfaceMuted,
              side: const BorderSide(color: AppColors.border),
            ),
            icon: const Icon(Icons.add_rounded, color: AppColors.accent),
            tooltip: 'Assign line items',
          ),
        ],
      ),
    );
  }

  Future<void> _openLineItemPicker(User participant) async {
    final options = _splittableLineItemEntries
        .map(
          (entry) => _LineItemSelectionOption(
            sourceIndex: entry.sourceIndex,
            title: _lineItemDisplayName(entry.row, entry.sourceIndex),
            totalCents: entry.row.lineTotalCents,
          ),
        )
        .toList();
    if (options.isEmpty) return;

    final selectedByUser = {
      for (final option in options)
        if ((_lineItemAssignments[option.sourceIndex] ?? const <String>{})
            .contains(participant.id))
          option.sourceIndex,
    };

    final picked = await showModalBottomSheet<Set<int>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => _LineItemPickerSheet(
        participantName: participant.id == _currentUser.id
            ? 'You'
            : displayName(participant),
        options: options,
        initiallySelected: selectedByUser,
      ),
    );
    if (picked == null) return;

    setState(() {
      for (final option in options) {
        final assigned = {
          ...(_lineItemAssignments[option.sourceIndex] ?? <String>{}),
        };
        assigned.remove(participant.id);
        if (picked.contains(option.sourceIndex)) {
          assigned.add(participant.id);
        }
        _lineItemAssignments[option.sourceIndex] = assigned;
      }
      _error = null;
      _normalizeLineItemAssignments();
    });
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
                    Icon(
                      Icons.balance_rounded,
                      size: 16,
                      color: AppColors.textH,
                    ),
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
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.accent, width: 2),
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
                        color: AppColors.textH,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    TextSpan(
                      text: participant.id == _currentUser.id
                          ? 'You'
                          : displayName(participant),
                      style: const TextStyle(
                        color: AppColors.textH,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Text(
              formatCad(
                payerShareCents.clamp(
                  0,
                  payerShareCents < 0 ? 0 : payerShareCents,
                ),
              ),
              style: const TextStyle(
                color: AppColors.textH,
                fontWeight: FontWeight.w800,
                fontSize: 18,
              ),
            ),
          ],
        ),
      );
    }

    final entryIndex = _splitEntries.indexWhere(
      (entry) => entry.user.id == participant.id,
    );
    final entry = entryIndex >= 0
        ? _splitEntries[entryIndex]
        : ManualSplitEntry(user: participant, shareCents: 0);
    final controller = _controllerForUser(
      participant.id,
      initialCents: entry.shareCents,
    );

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
                  participant.id == _currentUser.id
                      ? 'You'
                      : displayName(participant),
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
                    textStyle: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
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
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
              ],
              textAlign: TextAlign.right,
              decoration: InputDecoration(
                isDense: true,
                prefixText: r'$ ',
                hintText: '0.00',
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 10,
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(
                    color: AppColors.accent,
                    width: 2,
                  ),
                ),
              ),
              onChanged: (value) => _syncSplitEntry(participant.id, value),
            ),
          ),
        ],
      ),
    );
  }

  CaptureShareResult _buildLineItemShareResult(List<String> participantIds) {
    final options = _splittableLineItemEntries;
    final items = options
        .map(
          (entry) => ReceiptItem(
            name: _lineItemDisplayName(entry.row, entry.sourceIndex),
            quantity:
                (double.tryParse(entry.row.quantityController.text.trim()) ?? 1)
                    .round(),
            unitPrice:
                (double.tryParse(
                          entry.row.priceController.text.trim().replaceAll(
                            ',',
                            '',
                          ),
                        ) ??
                        0)
                    .toDouble(),
            totalPrice: entry.row.lineTotalCents / 100,
          ),
        )
        .toList();
    final assignments = <int, Set<String>>{};
    final validIds = participantIds.toSet();
    for (var i = 0; i < options.length; i++) {
      final sourceIndex = options[i].sourceIndex;
      assignments[i] = (_lineItemAssignments[sourceIndex] ?? const <String>{})
          .where(validIds.contains)
          .toSet();
    }

    final receipt = ParsedReceipt(
      storeName: _nullableTrim(_storeNameController),
      storeAddress: _nullableTrim(_storeAddressController),
      receiptNumber: _nullableTrim(_receiptNumberController),
      date: _nullableTrim(_receiptDateController),
      time: _nullableTrim(_receiptTimeController),
      items: items,
      itemCount: items.length,
      subtotal: _subtotalCents / 100,
      otherFees: _otherFeesCents / 100,
      tax: _taxCents / 100,
      tip: _tipCents / 100,
      total: _lineItemsFinalTotalCents != null
          ? _lineItemsFinalTotalCents! / 100
          : null,
      paymentMethod: _nullableTrim(_paymentMethodController),
      cardLast4: _nullableTrim(_cardLast4Controller),
    );
    return computeCaptureShares(
      receipt: receipt,
      items: items,
      assignments: assignments,
      participantIds: participantIds,
    );
  }

  Map<String, dynamic> _buildPayload() {
    final total = _totalCents!;
    final description = _titleController.text.trim();
    final isSplitWithGroup = _isGroupSplit;
    final isSplitWithFriends = _isSplitWithAnyone;
    final isSplitByFinalAmounts =
        isSplitWithGroup || !_isSplitByLineItemMode || !isSplitWithFriends;

    final basePayload = <String, dynamic>{
      'description': description,
      'incurredAt': _resolvedIncurredAtIso(),
      'totalCents': total,
      'source': _billSource.name,
      'isOneMainTotal': !_lineItemsEnabled,
      'isSplitWithFriends': isSplitWithFriends,
      'isSplitWithGroup': isSplitWithGroup,
      'isSplitByFinalAmounts': isSplitByFinalAmounts,
      if (isSplitWithGroup) 'groupId': _selectedGroupId,
      if (!isSplitWithGroup) 'groupId': null,
      'storeName': _nullableTrim(_storeNameController),
      'storeAddress': _nullableTrim(_storeAddressController),
      'receiptNumber': _nullableTrim(_receiptNumberController),
      'receiptDate': _nullableTrim(_receiptDateController),
      'receiptTime': _nullableTrim(_receiptTimeController),
      'paymentMethod': _nullableTrim(_paymentMethodController),
      'cardLast4': _nullableTrim(_cardLast4Controller),
    };

    if (_lineItemsEnabled) {
      final lineItemEntries = _lineItemRows
          .asMap()
          .entries
          .where((entry) => entry.value.lineTotalCents > 0)
          .toList();
      final validParticipantIds = _activeParticipantIds;
      basePayload.addAll({
        'subtotalCents': _subtotalCents,
        'taxCents': _taxCents,
        'tipCents': _tipCents,
        if (_otherFeesCents > 0) 'otherFeesCents': _otherFeesCents,
        'itemCount': lineItemEntries.length,
        'lineItems': lineItemEntries.map((entry) {
          final sourceIndex = entry.key;
          final row = entry.value;
          final quantity =
              double.tryParse(row.quantityController.text.trim()) ?? 1;
          final unitPrice =
              double.tryParse(
                row.priceController.text.trim().replaceAll(',', ''),
              ) ??
              0;
          final unitPriceCents = (unitPrice * 100).round();
          return {
            'name': row.titleController.text.trim().isEmpty
                ? 'Item ${sourceIndex + 1}'
                : row.titleController.text.trim(),
            'quantity': quantity,
            'unitPriceCents': unitPriceCents,
            'totalPriceCents': row.lineTotalCents,
            'assignedUserIds': isSplitByFinalAmounts
                ? const <String>[]
                : (_lineItemAssignments[sourceIndex] ?? const <String>{})
                      .where(validParticipantIds.contains)
                      .toList(),
          };
        }).toList(),
      });
    }

    if (!isSplitWithFriends) {
      return basePayload;
    }

    if (isSplitWithGroup) {
      final payerId = _selectedPayerId ?? _currentUser.id;
      return {
        ...basePayload,
        'payerId': payerId,
      };
    }

    final currentUser = _currentUser;
    final payerId = _selectedPayerId ?? currentUser.id;
    final participantIds = [
      currentUser.id,
      ..._selectedFriendUsers.map((friend) => friend.id),
    ];
    final sharesByUserId = _isSplitByLineItemMode
        ? {
            for (final share in _buildLineItemShareResult(
              participantIds,
            ).shares)
              share.userId: share.shareCents,
          }
        : {
            for (final participantId in participantIds)
              participantId: _shareForUser(participantId),
          };
    final payerShare = sharesByUserId[payerId] ?? 0;

    return {
      ...basePayload,
      'participantIds': participantIds,
      'payerId': payerId,
      'shares': participantIds
          .map(
            (userId) => {
              'userId': userId,
              'shareCents': userId == payerId
                  ? payerShare
                  : (sharesByUserId[userId] ?? 0),
              'lenderId': payerId,
            },
          )
          .toList(),
    };
  }

  Future<void> _save() async {
    if (_saving) return;
    if (!_validateForm()) return;

    HapticFeedback.mediumImpact();
    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final billId = widget.initialBill?.id;
      final bill = billId == null
          ? await ref.read(billsApiProvider).createBill(_buildPayload())
          : await ref
                .read(billsApiProvider)
                .updateBill(billId, _buildPayload());
      notifyDataChanged(ref);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            billId == null
                ? 'Bill saved successfully.'
                : 'Bill updated successfully.',
          ),
        ),
      );
      setState(() => _saving = false);
      context.pop();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = apiErrorMessage(e, 'Unable to save bill.');
        _saving = false;
      });
    }
  }

  Widget _buildSaveButton(bool isEditing) {
    final label = isEditing ? 'Save changes' : 'Save bill';

    return SizedBox(
      width: double.infinity,
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF102F2D),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: AppColors.brandSoft.withValues(alpha: 0.45),
            width: 1.5,
          ),
        ),
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(16),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: _saving ? null : _save,
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (_saving)
                    const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  else
                    const Icon(
                      Icons.check_rounded,
                      color: Colors.white,
                      size: 22,
                    ),
                  const SizedBox(width: 10),
                  Text(
                    label,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                      letterSpacing: 0.2,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isEditing = widget.initialBill != null;
    final isFromPhoto = _imageBytes != null && !isEditing;
    final title = isEditing
        ? 'Edit bill'
        : isFromPhoto
        ? 'Add bill from receipt'
        : 'Add bill manually';

    final isLoading = _awaitingConsent || _parsing || _loadingFriends;

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      bottomNavigationBar: isLoading
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    AnimatedSize(
                      duration: const Duration(milliseconds: 220),
                      curve: Curves.easeOutCubic,
                      alignment: Alignment.bottomCenter,
                      child: _error == null
                          ? const SizedBox.shrink()
                          : Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Material(
                                elevation: 6,
                                shadowColor: Colors.black.withValues(alpha: 0.28),
                                borderRadius: BorderRadius.circular(13),
                                color: Colors.transparent,
                                child: ErrorBanner(message: _error!),
                              ),
                            ),
                    ),
                    _buildSaveButton(isEditing),
                  ],
                ),
              ),
            ),
      body: isLoading
          ? LoadingView(
              message: _parsing ? 'Parsing receipt...' : 'Loading...',
            )
          : GestureDetector(
              onTap: _dismissKeyboard,
              behavior: HitTestBehavior.opaque,
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  _buildBillDetailsCard(),
                ],
              ),
            ),
    );
  }
}

class _LineItemPickerSheet extends StatefulWidget {
  const _LineItemPickerSheet({
    required this.participantName,
    required this.options,
    required this.initiallySelected,
  });

  final String participantName;
  final List<_LineItemSelectionOption> options;
  final Set<int> initiallySelected;

  @override
  State<_LineItemPickerSheet> createState() => _LineItemPickerSheetState();
}

class _LineItemPickerSheetState extends State<_LineItemPickerSheet> {
  late final Set<int> _selected;

  @override
  void initState() {
    super.initState();
    _selected = {...widget.initiallySelected};
  }

  void _toggle(int sourceIndex) {
    setState(() {
      if (_selected.contains(sourceIndex)) {
        _selected.remove(sourceIndex);
      } else {
        _selected.add(sourceIndex);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
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
          const SizedBox(height: 14),
          Text(
            'Assign line items to ${widget.participantName}',
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 16,
              color: AppColors.textH,
            ),
          ),
          const SizedBox(height: 10),
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.45,
            ),
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: widget.options.length,
              separatorBuilder: (context, _) =>
                  const Divider(height: 1, color: AppColors.border),
              itemBuilder: (context, index) {
                final option = widget.options[index];
                final checked = _selected.contains(option.sourceIndex);
                return InkWell(
                  onTap: () => _toggle(option.sourceIndex),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      children: [
                        Checkbox(
                          value: checked,
                          activeColor: AppColors.accent,
                          onChanged: (_) => _toggle(option.sourceIndex),
                        ),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                option.title,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textH,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                formatCad(option.totalCents),
                                style: const TextStyle(color: AppColors.text),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 14),
          PrimaryButton(
            label: 'Apply',
            onPressed: () => Navigator.pop(context, _selected),
          ),
        ],
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
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 12,
                vertical: 12,
              ),
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
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                  ),
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
