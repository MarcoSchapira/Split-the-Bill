import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../api/api_exception.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../../utils/request_items.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/requests/request_list_item.dart';
import '../../widgets/segmented_toggle.dart';

enum _RequestsTab { owedToYou, youOwe }

class RequestsScreen extends ConsumerStatefulWidget {
  const RequestsScreen({super.key, this.initialTab});

  final String? initialTab;

  @override
  ConsumerState<RequestsScreen> createState() => _RequestsScreenState();
}

class _RequestsScreenState extends ConsumerState<RequestsScreen> {
  late final PageController _pageController;
  late _RequestsTab _selectedTab;
  List<Bill> _bills = [];
  String? _error;
  bool _isLoading = true;
  String? _settlingShareId;

  @override
  void initState() {
    super.initState();
    _selectedTab = _tabFromQuery(widget.initialTab);
    _pageController = PageController(initialPage: _selectedTab.index);
    _load();
  }

  @override
  void didUpdateWidget(covariant RequestsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialTab == widget.initialTab) return;

    final nextTab = _tabFromQuery(widget.initialTab);
    if (_selectedTab == nextTab) return;

    setState(() => _selectedTab = nextTab);
    if (_pageController.hasClients) {
      _pageController.jumpToPage(nextTab.index);
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _error = null;
      _isLoading = true;
    });

    try {
      final bills = await ref.read(billsApiProvider).listBills();
      if (mounted) setState(() => _bills = bills);
    } catch (e) {
      if (mounted) {
        setState(
          () => _error = apiErrorMessage(e, 'Unable to load requests.'),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _selectTab(_RequestsTab tab) {
    if (_selectedTab == tab) return;
    HapticFeedback.selectionClick();
    _pageController.animateToPage(
      tab.index,
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOutCubic,
    );
  }

  void _onPageChanged(int index) {
    final tab = _RequestsTab.values[index];
    if (_selectedTab == tab) return;
    HapticFeedback.selectionClick();
    setState(() => _selectedTab = tab);
  }

  Future<void> _markPaid(RequestItem item) async {
    setState(() => _settlingShareId = item.shareId);

    try {
      if (item.role == RequestRole.debtor) {
        await ref.read(billsApiProvider).settleBill(item.billId);
      } else {
        await ref
            .read(billsApiProvider)
            .settleBill(
              item.billId,
              participantUserId: item.counterparty.id,
            );
      }
      notifyDataChanged(ref);
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              item.role == RequestRole.debtor
                  ? 'Marked as paid.'
                  : '${displayName(item.counterparty)} marked as paid.',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              apiErrorMessage(e, 'Unable to update payment status.'),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _settlingShareId = null);
    }
  }

  _RequestsTab _tabFromQuery(String? tab) {
    switch (tab) {
      case 'you-owe':
        return _RequestsTab.youOwe;
      case 'owed-to-you':
      default:
        return _RequestsTab.owedToYou;
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(dataRefreshProvider, (_, __) => _load());

    final currentUserId = ref.watch(authProvider).user?.id;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Text(
            'Requests',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
          ),
        ),
        Expanded(
          child: PageView(
            controller: _pageController,
            onPageChanged: _onPageChanged,
            children: [
              _RequestsTabBody(
                tab: _RequestsTab.owedToYou,
                bills: _bills,
                currentUserId: currentUserId,
                isLoading: _isLoading,
                error: _error,
                settlingShareId: _settlingShareId,
                onRefresh: _load,
                onMarkPaid: _markPaid,
              ),
              _RequestsTabBody(
                tab: _RequestsTab.youOwe,
                bills: _bills,
                currentUserId: currentUserId,
                isLoading: _isLoading,
                error: _error,
                settlingShareId: _settlingShareId,
                onRefresh: _load,
                onMarkPaid: _markPaid,
              ),
            ],
          ),
        ),
        _RequestsSegmentBar(
          pageController: _pageController,
          selectedTab: _selectedTab,
          onChanged: _selectTab,
        ),
      ],
    );
  }
}

class _RequestsTabBody extends StatelessWidget {
  const _RequestsTabBody({
    required this.tab,
    required this.bills,
    required this.currentUserId,
    required this.isLoading,
    required this.error,
    required this.settlingShareId,
    required this.onRefresh,
    required this.onMarkPaid,
  });

  final _RequestsTab tab;
  final List<Bill> bills;
  final String? currentUserId;
  final bool isLoading;
  final String? error;
  final String? settlingShareId;
  final Future<void> Function() onRefresh;
  final Future<void> Function(RequestItem item) onMarkPaid;

  @override
  Widget build(BuildContext context) {
    if (isLoading && bills.isEmpty) {
      return const LoadingView(message: 'Loading requests...');
    }

    final owedToYou = tab == _RequestsTab.owedToYou;
    final userId = currentUserId;
    final items = userId == null
        ? const <RequestItem>[]
        : requestItemsFromBills(
            bills: bills,
            currentUserId: userId,
            direction: owedToYou
                ? RequestDirection.owedToYou
                : RequestDirection.youOwe,
          );

    if (items.isEmpty && error == null) {
      return ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
        children: [
          const SizedBox(height: 48),
          _RequestsEmptyState(
            icon: owedToYou
                ? Icons.arrow_downward_rounded
                : Icons.arrow_upward_rounded,
            iconColor: owedToYou ? AppColors.accent : AppColors.error,
            iconBackground:
                owedToYou ? AppColors.accentSoft : AppColors.errorBg,
            title: owedToYou
                ? 'Nothing owed to you yet'
                : 'Nothing to pay right now',
            message: owedToYou
                ? 'When someone owes you from a shared bill, their request will show up here.'
                : 'When you owe someone from a shared bill, their request will show up here.',
          ),
        ],
      );
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      color: AppColors.accent,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          if (error != null) ...[
            ErrorBanner(message: error!),
            const SizedBox(height: 12),
          ],
          ...items.map(
            (item) => RequestListItem(
              key: ValueKey(item.shareId),
              item: item,
              isSettling: settlingShareId == item.shareId,
              onMarkPaid: () => onMarkPaid(item),
            ),
          ),
        ],
      ),
    );
  }
}

class _RequestsEmptyState extends StatelessWidget {
  const _RequestsEmptyState({
    required this.icon,
    required this.iconColor,
    required this.iconBackground,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final Color iconColor;
  final Color iconBackground;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Column(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: iconBackground,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(icon, color: iconColor, size: 28),
          ),
          const SizedBox(height: 16),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w600,
              color: AppColors.textH,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.text, height: 1.45),
          ),
        ],
      ),
    );
  }
}

class _RequestsSegmentBar extends StatelessWidget {
  const _RequestsSegmentBar({
    required this.pageController,
    required this.selectedTab,
    required this.onChanged,
  });

  final PageController pageController;
  final _RequestsTab selectedTab;
  final ValueChanged<_RequestsTab> onChanged;

  static const _tabs = [
    (
      _RequestsTab.owedToYou,
      SegmentedToggleItem(label: 'You are Owed', semanticLabel: 'You are Owed'),
    ),
    (
      _RequestsTab.youOwe,
      SegmentedToggleItem(label: 'You Owe', semanticLabel: 'You Owe'),
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          child: LayoutBuilder(
            builder: (context, _) {
              final selectedIndex = _tabs.indexWhere(
                (tab) => tab.$1 == selectedTab,
              );

              return AnimatedBuilder(
                animation: pageController,
                builder: (context, _) {
                  final indicatorPosition = pageController.hasClients
                      ? (pageController.page ?? selectedIndex.toDouble())
                      : selectedIndex.toDouble();

                  return SegmentedToggle(
                    items: _tabs.map((tab) => tab.$2).toList(growable: false),
                    selectedIndex: selectedIndex,
                    thumbPosition: indicatorPosition,
                    onSelected: (index) => onChanged(_tabs[index].$1),
                  );
                },
              );
            },
          ),
        ),
      ),
    );
  }
}
