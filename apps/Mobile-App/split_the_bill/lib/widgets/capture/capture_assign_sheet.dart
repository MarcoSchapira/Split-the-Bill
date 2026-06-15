import 'package:flutter/material.dart';
import '../../models/user.dart';
import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../../widgets/common_widgets.dart';

class CaptureAssignSheet extends StatefulWidget {
  const CaptureAssignSheet({
    super.key,
    required this.title,
    required this.participants,
    required this.initialSelected,
  });

  final String title;
  final List<User> participants;
  final Set<String> initialSelected;

  @override
  State<CaptureAssignSheet> createState() => _CaptureAssignSheetState();
}

class _CaptureAssignSheetState extends State<CaptureAssignSheet> {
  late Set<String> _selected;

  @override
  void initState() {
    super.initState();
    _selected = Set<String>.from(widget.initialSelected);
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
          Text(
            widget.title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: 12),
          ...widget.participants.map(
            (participant) => CheckboxListTile(
              value: _selected.contains(participant.id),
              activeColor: AppColors.accent,
              title: Text(displayName(participant)),
              onChanged: (value) {
                setState(() {
                  if (value == true) {
                    _selected.add(participant.id);
                  } else {
                    _selected.remove(participant.id);
                  }
                });
              },
            ),
          ),
          const SizedBox(height: 12),
          PrimaryButton(
            label: 'Done',
            onPressed: _selected.isEmpty ? null : () => Navigator.pop(context, _selected),
          ),
        ],
      ),
    );
  }
}
