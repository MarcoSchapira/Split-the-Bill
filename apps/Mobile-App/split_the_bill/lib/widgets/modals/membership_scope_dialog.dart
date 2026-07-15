import 'package:flutter/material.dart';

enum MembershipConfirmAction { add, remove, leave }

/// Confirms a membership change when the group already has bills.
/// Returns `true` if the user confirms, `false`/`null` if cancelled.
Future<bool?> showMembershipConfirmDialog(
  BuildContext context, {
  required MembershipConfirmAction action,
  required String subjectName,
  required String groupName,
}) {
  final (title, body) = switch (action) {
    MembershipConfirmAction.add => (
        'Add $subjectName to $groupName?',
        '$subjectName will only be included in new expenses, not in any current bills.',
      ),
    MembershipConfirmAction.remove => (
        'Remove $subjectName from $groupName?',
        '$subjectName will stay on current bills but will not be included in future ones.',
      ),
    MembershipConfirmAction.leave => (
        'Leave $groupName?',
        'You will stay on current bills but will not be included in future ones.',
      ),
  };

  return showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: Text(body),
      actionsAlignment: MainAxisAlignment.center,
      actions: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Confirm'),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
          ],
        ),
      ],
    ),
  );
}
