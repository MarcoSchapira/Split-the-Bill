import '../models/receipt.dart';

class CaptureShareDraft {
  const CaptureShareDraft({required this.userId, required this.shareCents});

  final String userId;
  final int shareCents;
}

class CaptureShareResult {
  const CaptureShareResult({
    required this.shares,
    required this.totalCents,
  });

  final List<CaptureShareDraft> shares;
  final int totalCents;
}

int _dollarsToCents(double? value) {
  if (value == null) return 0;
  return (value * 100).round();
}

CaptureShareResult computeCaptureShares({
  required ParsedReceipt receipt,
  required List<ReceiptItem> items,
  required Map<int, Set<String>> assignments,
  required List<String> participantIds,
}) {
  final participants = participantIds.toSet().toList()..sort();
  final baseCents = <String, int>{for (final id in participants) id: 0};

  var itemsSubtotalCents = 0;

  for (var index = 0; index < items.length; index++) {
    final item = items[index];
    final assignees = (assignments[index] ?? {}).toList()..sort();
    if (assignees.isEmpty) {
      throw StateError('Item "${item.name}" has no assignees');
    }

    itemsSubtotalCents += item.totalPriceCents;
    final perAssignee = item.totalPriceCents ~/ assignees.length;
    final remainder = item.totalPriceCents % assignees.length;

    for (var i = 0; i < assignees.length; i++) {
      final userId = assignees[i];
      final extra = i < remainder ? 1 : 0;
      baseCents[userId] = (baseCents[userId] ?? 0) + perAssignee + extra;
    }
  }

  final taxCents = _dollarsToCents(receipt.tax);
  final tipCents = _dollarsToCents(receipt.tip);
  final otherFeesCents = _dollarsToCents(receipt.otherFees);
  final extrasCents = taxCents + tipCents + otherFeesCents;
  final extrasBase = <String, int>{for (final id in participants) id: 0};

  if (extrasCents > 0) {
    if (itemsSubtotalCents > 0) {
      var allocated = 0;
      for (var i = 0; i < participants.length; i++) {
        final userId = participants[i];
        final userBase = baseCents[userId] ?? 0;
        if (i == participants.length - 1) {
          extrasBase[userId] = extrasCents - allocated;
        } else {
          final share = ((extrasCents * userBase) / itemsSubtotalCents).floor();
          extrasBase[userId] = share;
          allocated += share;
        }
      }
    } else {
      final perUser = extrasCents ~/ participants.length;
      final remainder = extrasCents % participants.length;
      for (var i = 0; i < participants.length; i++) {
        extrasBase[participants[i]] = perUser + (i < remainder ? 1 : 0);
      }
    }
  }

  final totalCents = receipt.total != null
      ? _dollarsToCents(receipt.total)
      : itemsSubtotalCents + extrasCents;

  final shares = participants
      .map(
        (userId) => CaptureShareDraft(
          userId: userId,
          shareCents: (baseCents[userId] ?? 0) + (extrasBase[userId] ?? 0),
        ),
      )
      .toList();

  final shareSum = shares.fold<int>(0, (sum, share) => sum + share.shareCents);
  if (shareSum != totalCents && shares.isNotEmpty) {
    final diff = totalCents - shareSum;
    final first = shares.first;
    shares[0] = CaptureShareDraft(
      userId: first.userId,
      shareCents: first.shareCents + diff,
    );
  }

  return CaptureShareResult(shares: shares, totalCents: totalCents);
}

List<({ReceiptItem item, int shareCents})> itemsForUser({
  required List<ReceiptItem> items,
  required Map<int, Set<String>> assignments,
  required String targetUserId,
}) {
  final result = <({ReceiptItem item, int shareCents})>[];
  for (var index = 0; index < items.length; index++) {
    final assignees = assignments[index] ?? {};
    if (!assignees.contains(targetUserId)) continue;

    final item = items[index];
    final perAssignee = item.totalPriceCents ~/ assignees.length;
    final remainder = item.totalPriceCents % assignees.length;
    final sorted = assignees.toList()..sort();
    final position = sorted.indexOf(targetUserId);
    final extra = position < remainder ? 1 : 0;
    result.add((item: item, shareCents: perAssignee + extra));
  }
  return result;
}

int userItemSubtotalCents({
  required List<ReceiptItem> items,
  required Map<int, Set<String>> assignments,
  required String targetUserId,
}) {
  return itemsForUser(
    items: items,
    assignments: assignments,
    targetUserId: targetUserId,
  ).fold<int>(0, (sum, entry) => sum + entry.shareCents);
}
