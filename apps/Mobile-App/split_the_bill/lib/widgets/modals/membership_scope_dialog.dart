import 'package:flutter/material.dart';

enum MembershipScopeAction { add, remove, leave }

enum MembershipRetroactiveScope { newOnly, unsettledBills }

Future<MembershipRetroactiveScope?> showMembershipScopeDialog(
  BuildContext context, {
  required MembershipScopeAction action,
  required String subjectName,
  required String groupName,
}) {
  final isAdd = action == MembershipScopeAction.add;
  final title = switch (action) {
    MembershipScopeAction.add => 'Add $subjectName to $groupName?',
    MembershipScopeAction.remove => 'Remove $subjectName from $groupName?',
    MembershipScopeAction.leave => 'Leave $groupName?',
  };
  final body = isAdd
      ? 'This group has existing expenses.'
      : 'This member has shares on unpaid group expenses.';
  final primaryLabel = isAdd
      ? 'Only include in new expenses'
      : 'Only exclude from new expenses';
  final secondaryLabel = isAdd
      ? 'Add to unpaid expenses'
      : 'Remove from unpaid expenses';

  return showDialog<MembershipRetroactiveScope>(
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
              onPressed: () => Navigator.pop(
                context,
                MembershipRetroactiveScope.newOnly,
              ),
              child: Text(primaryLabel),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: () => Navigator.pop(
                context,
                MembershipRetroactiveScope.unsettledBills,
              ),
              child: Text(secondaryLabel),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
          ],
        ),
      ],
    ),
  );
}

String membershipScopeToApi(MembershipRetroactiveScope scope) {
  return switch (scope) {
    MembershipRetroactiveScope.newOnly => 'new_only',
    MembershipRetroactiveScope.unsettledBills => 'unsettled_bills',
  };
}
