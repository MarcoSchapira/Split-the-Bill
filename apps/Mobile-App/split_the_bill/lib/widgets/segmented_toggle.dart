import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class SegmentedToggleItem {
  const SegmentedToggleItem({
    required this.label,
    this.icon,
    this.semanticLabel,
  });

  final String label;
  final IconData? icon;
  final String? semanticLabel;
}

class SegmentedToggle extends StatelessWidget {
  const SegmentedToggle({
    super.key,
    required this.items,
    required this.selectedIndex,
    required this.onSelected,
    this.thumbPosition,
    this.height = 44,
    this.borderRadius = const BorderRadius.all(Radius.circular(13)),
  }) : assert(items.length >= 2, 'SegmentedToggle needs at least two items');

  final List<SegmentedToggleItem> items;
  final int selectedIndex;
  final ValueChanged<int> onSelected;
  final double? thumbPosition;
  final double height;
  final BorderRadius borderRadius;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final segmentWidth = constraints.maxWidth / items.length;
        final indicatorPosition = thumbPosition ?? selectedIndex.toDouble();

        return Container(
          height: height,
          decoration: BoxDecoration(
            color: AppColors.surfaceMuted,
            borderRadius: borderRadius,
            border: Border.all(color: AppColors.border),
          ),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              if (thumbPosition == null)
                AnimatedPositioned(
                  duration: const Duration(milliseconds: 220),
                  curve: Curves.easeOutCubic,
                  left: indicatorPosition * segmentWidth + 3,
                  top: 3,
                  bottom: 3,
                  width: segmentWidth - 6,
                  child: _buildSelectionPill(),
                )
              else
                Positioned(
                  left: indicatorPosition * segmentWidth + 3,
                  top: 3,
                  bottom: 3,
                  width: segmentWidth - 6,
                  child: _buildSelectionPill(),
                ),
              Row(
                children: [
                  for (var index = 0; index < items.length; index++)
                    Expanded(
                      child: _SegmentedToggleButton(
                        item: items[index],
                        selected: selectedIndex == index,
                        onTap: () => onSelected(index),
                      ),
                    ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildSelectionPill() {
    return DecoratedBox(
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
    );
  }
}

class _SegmentedToggleButton extends StatelessWidget {
  const _SegmentedToggleButton({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final SegmentedToggleItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppColors.accent : AppColors.text;

    return Semantics(
      button: true,
      selected: selected,
      label: item.semanticLabel ?? item.label,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Center(
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (item.icon != null) ...[
                Icon(item.icon, size: 18, color: color),
                const SizedBox(width: 6),
              ],
              Flexible(
                child: Text(
                  item.label,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                    color: color,
                    letterSpacing: selected ? 0.01 : 0,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
