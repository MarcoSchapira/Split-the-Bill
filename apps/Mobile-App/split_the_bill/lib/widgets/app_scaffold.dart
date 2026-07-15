import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme/app_colors.dart';
import 'common_widgets.dart';
import 'modals/capture_options_sheet.dart';

class AppScaffold extends StatelessWidget {
  const AppScaffold({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const tabs = [
    ('Dashboard', Icons.dashboard_outlined, Icons.dashboard),
    ('Bills', Icons.receipt_long_outlined, Icons.receipt_long),
    ('Requests', Icons.inbox_outlined, Icons.inbox),
    ('Groups', Icons.people_outline, Icons.people),
  ];

  static const tabRootPaths = {
    '/dashboard',
    '/dashboard/activity',
    '/bills',
    '/requests',
    '/groups',
  };

  static const _captureButtonDiameter = 64.0;
  static const _captureButtonRadius = _captureButtonDiameter / 2;
  static const _navigationBarHeight = 74.0;
  static const _centerNavSlotIndex = 2;
  static const _tabHorizontalInset = 15.0;
  static const _captureVerticalOffset = 28.0;

  @override
  Widget build(BuildContext context) {
    final router = GoRouter.of(context);

    return ListenableBuilder(
      listenable: router.routerDelegate,
      builder: (context, _) {
        final index = navigationShell.currentIndex;
        final navIndex = _branchToNavIndex(index);
        final location = router.state.uri.path;
        final isTabRoot = tabRootPaths.contains(location);

        return Scaffold(
          appBar: isTabRoot
              ? AppBar(
                  title: const AppBrandTitle(),
                  actions: [
                    IconButton(
                      icon: const Icon(Icons.settings_outlined),
                      tooltip: 'Settings',
                      onPressed: () => context.push('/settings'),
                    ),
                  ],
                )
              : null,
          body: navigationShell,
          bottomNavigationBar: ColoredBox(
            color: AppColors.surface,
            child: SafeArea(
              top: false,
              child: SizedBox(
                height: _navigationBarHeight,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned.fill(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: _tabHorizontalInset),
                        child: NavigationBar(
                          height: _navigationBarHeight,
                          selectedIndex: navIndex,
                          onDestinationSelected: (selectedIndex) {
                            if (selectedIndex == _centerNavSlotIndex) return;
                            final branchIndex = _navToBranchIndex(selectedIndex);
                            navigationShell.goBranch(
                              branchIndex,
                              initialLocation: branchIndex == index,
                            );
                          },
                          destinations: [
                            NavigationDestination(
                              icon: Icon(tabs[0].$2),
                              selectedIcon: Icon(tabs[0].$3),
                              label: tabs[0].$1,
                            ),
                            NavigationDestination(
                              icon: Icon(tabs[1].$2),
                              selectedIcon: Icon(tabs[1].$3),
                              label: tabs[1].$1,
                            ),
                            const NavigationDestination(
                              icon: SizedBox.shrink(),
                              selectedIcon: SizedBox.shrink(),
                              label: '',
                            ),
                            NavigationDestination(
                              icon: Icon(tabs[2].$2),
                              selectedIcon: Icon(tabs[2].$3),
                              label: tabs[2].$1,
                            ),
                            NavigationDestination(
                              icon: Icon(tabs[3].$2),
                              selectedIcon: Icon(tabs[3].$3),
                              label: tabs[3].$1,
                            ),
                          ],
                        ),
                      ),
                    ),
                    Positioned.fill(
                      child: IgnorePointer(
                        child: CustomPaint(
                          painter: _CaptureTopBorderPainter(
                            color: AppColors.border,
                            centerRadius: _captureButtonRadius -4,
                          ),
                        ),
                      ),
                    ),
                    const Positioned.fill(child: _CenterNavSlotBlocker()),
                    Positioned(
                      top: -_captureVerticalOffset,
                      left: 0,
                      right: 0,
                      child: Center(
                        child: Container(
                          width: _captureButtonDiameter,
                          height: _captureButtonDiameter,
                          decoration: BoxDecoration(
                            color: AppColors.accent,
                            shape: BoxShape.circle,
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x2B112824),
                                blurRadius: 18,
                                offset: Offset(0, 8),
                              ),
                            ],
                            border: Border.all(color: AppColors.border, width: 4),
                          ),
                          child: Material(
                            color: Colors.transparent,
                            shape: const CircleBorder(),
                            child: InkWell(
                              customBorder: const CircleBorder(),
                              onTap: () => showCaptureOptionsSheet(context),
                              child: const Center(
                                child: Icon(Icons.camera_alt, color: Colors.white, size: 30),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  int _branchToNavIndex(int branchIndex) {
    if (branchIndex >= _centerNavSlotIndex) {
      return branchIndex + 1;
    }
    return branchIndex;
  }

  int _navToBranchIndex(int navIndex) {
    if (navIndex > _centerNavSlotIndex) {
      return navIndex - 1;
    }
    return navIndex;
  }
}

class _CaptureTopBorderPainter extends CustomPainter {
  const _CaptureTopBorderPainter({
    required this.color,
    required this.centerRadius,
  });

  final Color color;
  final double centerRadius;

  @override
  void paint(Canvas canvas, Size size) {
    const topOffset = 3.0;
    final centerX = size.width / 2;
    final leftTransitionX = centerX - centerRadius - 12;
    final rightTransitionX = centerX + centerRadius + 12;
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.0
      ..strokeCap = StrokeCap.round;
    final path = Path()
      ..moveTo(0, topOffset)
      ..lineTo(leftTransitionX, topOffset)
      ..quadraticBezierTo(
        centerX - centerRadius - 5,
        topOffset,
        centerX - centerRadius,
        topOffset - 10,
      )
      ..arcToPoint(
        Offset(centerX + centerRadius, topOffset - 10),
        radius: Radius.circular(centerRadius + 8),
        clockwise: false,
      )
      ..quadraticBezierTo(
        centerX + centerRadius + 5,
        topOffset,
        rightTransitionX,
        topOffset,
      )
      ..lineTo(size.width, topOffset);

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _CaptureTopBorderPainter oldDelegate) {
    return oldDelegate.color != color || oldDelegate.centerRadius != centerRadius;
  }
}

class _CenterNavSlotBlocker extends StatelessWidget {
  const _CenterNavSlotBlocker();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final centerSlotWidth = constraints.maxWidth / 5;
        return Align(
          alignment: Alignment.center,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () {},
            onLongPress: () {},
            child: SizedBox(
              width: centerSlotWidth,
              height: double.infinity,
            ),
          ),
        );
      },
    );
  }
}
