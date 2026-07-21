/// Splits a line item's total across its assignees using the same rule as
/// `computeCaptureShares`: integer division, with the leftover cents handed to
/// the first assignees in sorted-by-userId order. This keeps the display in
/// sync with the stored share math.
int lineItemShareForUser(
  int totalPriceCents,
  List<String> assigneeIds,
  String userId,
) {
  final assignees = assigneeIds.toSet().toList()..sort();
  if (assignees.isEmpty) return 0;

  final index = assignees.indexOf(userId);
  if (index < 0) return 0;

  final perAssignee = totalPriceCents ~/ assignees.length;
  final remainder = totalPriceCents % assignees.length;
  return perAssignee + (index < remainder ? 1 : 0);
}
