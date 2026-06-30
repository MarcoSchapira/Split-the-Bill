import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../theme/app_colors.dart';

enum _RequestsTab { owedToYou, youOwe }

class RequestsScreen extends StatefulWidget {
  const RequestsScreen({super.key});

  @override
  State<RequestsScreen> createState() => _RequestsScreenState();
}

class _RequestsScreenState extends State<RequestsScreen> {
  late final PageController _pageController;
  _RequestsTab _selectedTab = _RequestsTab.owedToYou;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
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

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Text('Requests', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
        ),
        Expanded(
          child: PageView(
            controller: _pageController,
            onPageChanged: _onPageChanged,
            children: const [
              _RequestsTabBody(tab: _RequestsTab.owedToYou),
              _RequestsTabBody(tab: _RequestsTab.youOwe),
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
  const _RequestsTabBody({required this.tab});

  final _RequestsTab tab;

  @override
  Widget build(BuildContext context) {
    final owedToYou = tab == _RequestsTab.owedToYou;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      children: [
        Text(
          owedToYou
              ? 'Money friends still need to send you.'
              : 'Payments you still need to make.',
          style: const TextStyle(color: AppColors.text),
        ),
        const SizedBox(height: 32),
        _RequestsEmptyState(
          icon: owedToYou ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded,
          iconColor: owedToYou ? AppColors.accent : AppColors.error,
          iconBackground: owedToYou ? AppColors.accentSoft : AppColors.errorBg,
          title: owedToYou ? 'Nothing owed to you yet' : 'Nothing to pay right now',
          message: owedToYou
              ? 'When someone owes you from a shared bill, their request will show up here.'
              : 'When you owe someone from a shared bill, their request will show up here.',
        ),
      ],
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
    (_RequestsTab.owedToYou, 'You are Owed'),
    (_RequestsTab.youOwe, 'You Owe'),
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
            builder: (context, constraints) {
              final tabWidth = constraints.maxWidth / _tabs.length;
              final selectedIndex = _tabs.indexWhere((tab) => tab.$1 == selectedTab);

              return AnimatedBuilder(
                animation: pageController,
                builder: (context, _) {
                  final page = pageController.hasClients
                      ? (pageController.page ?? selectedIndex.toDouble())
                      : selectedIndex.toDouble();

                  return Container(
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceMuted,
                      borderRadius: BorderRadius.circular(13),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Positioned(
                          left: page * tabWidth + 3,
                          top: 3,
                          bottom: 3,
                          width: tabWidth - 6,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              borderRadius: BorderRadius.circular(10),
                              boxShadow: [
                                BoxShadow(
                                  color: AppColors.textH.withValues(alpha: 0.07),
                                  blurRadius: 6,
                                  offset: const Offset(0, 1),
                                ),
                              ],
                            ),
                          ),
                        ),
                        Row(
                          children: [
                            for (final (tab, label) in _tabs)
                              Expanded(
                                child: Semantics(
                                  button: true,
                                  selected: selectedTab == tab,
                                  label: label,
                                  child: GestureDetector(
                                    onTap: () => onChanged(tab),
                                    behavior: HitTestBehavior.opaque,
                                    child: Center(
                                      child: Text(
                                        label,
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: selectedTab == tab ? FontWeight.w600 : FontWeight.w500,
                                          color: selectedTab == tab ? AppColors.accent : AppColors.text,
                                          letterSpacing: selectedTab == tab ? 0.01 : 0,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
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
