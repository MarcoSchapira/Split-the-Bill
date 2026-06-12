import '../models/user.dart';

enum SplitKind { equal, custom }

enum CustomSplitMode { amount, percent }

class BillShareDraft {
  const BillShareDraft({required this.userId, required this.shareCents});

  final String userId;
  final int shareCents;
}

class MemberSplitState {
  const MemberSplitState({
    required this.user,
    required this.included,
    required this.amount,
    required this.percent,
  });

  final User user;
  final bool included;
  final String amount;
  final String percent;

  MemberSplitState copyWith({
    User? user,
    bool? included,
    String? amount,
    String? percent,
  }) {
    return MemberSplitState(
      user: user ?? this.user,
      included: included ?? this.included,
      amount: amount ?? this.amount,
      percent: percent ?? this.percent,
    );
  }
}

List<BillShareDraft> equalShareCents(int totalCents, List<String> participantIds) {
  final ordered = participantIds.toSet().toList()..sort();
  if (ordered.isEmpty) return [];

  final baseShare = totalCents ~/ ordered.length;
  final remainder = totalCents % ordered.length;

  return ordered.asMap().entries.map((entry) {
    return BillShareDraft(
      userId: entry.value,
      shareCents: baseShare + (entry.key < remainder ? 1 : 0),
    );
  }).toList();
}

List<BillShareDraft> allocateFromPercents(
  int totalCents,
  List<({String userId, double percent})> entries,
) {
  if (entries.isEmpty) return [];

  final totalPercent = entries.fold<double>(0, (sum, e) => sum + e.percent);
  if (totalPercent <= 0) {
    return entries.map((e) => BillShareDraft(userId: e.userId, shareCents: 0)).toList();
  }

  final weighted = entries.map((entry) {
    final exact = (entry.percent / totalPercent) * totalCents;
    final floor = exact.floor();
    return (
      userId: entry.userId,
      shareCents: floor,
      remainder: exact - floor,
    );
  }).toList();

  var assigned = weighted.fold<int>(0, (sum, e) => sum + e.shareCents);
  final byRemainder = [...weighted]..sort((a, b) => b.remainder.compareTo(a.remainder));

  for (final entry in byRemainder) {
    if (assigned >= totalCents) break;
    final index = weighted.indexWhere((e) => e.userId == entry.userId);
    if (index >= 0) {
      weighted[index] = (
        userId: weighted[index].userId,
        shareCents: weighted[index].shareCents + 1,
        remainder: weighted[index].remainder,
      );
      assigned += 1;
    }
  }

  return weighted
      .map((e) => BillShareDraft(userId: e.userId, shareCents: e.shareCents))
      .toList();
}

int? parseAmountToCents(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return null;
  final parsed = double.tryParse(trimmed);
  if (parsed == null || parsed < 0) return null;
  return (parsed * 100).round();
}

String formatCentsAsAmount(int shareCents) {
  return (shareCents / 100).toStringAsFixed(2);
}

bool sharesAreEqual(int totalCents, List<BillShareDraft> shares) {
  if (shares.isEmpty) return false;
  final participantIds = shares.map((s) => s.userId).toList();
  final expected = equalShareCents(totalCents, participantIds);
  final expectedMap = {for (final s in expected) s.userId: s.shareCents};
  return shares.every((s) => expectedMap[s.userId] == s.shareCents);
}

bool inferPercentMode(List<BillShareDraft> shares, int totalCents) {
  if (totalCents <= 0 || shares.isEmpty) return false;

  final percents = shares
      .map((s) => ((s.shareCents / totalCents) * 100).round())
      .toList();
  final reconstructed = allocateFromPercents(
    totalCents,
    shares.asMap().entries.map((e) {
      return (userId: e.value.userId, percent: percents[e.key].toDouble());
    }).toList(),
  );

  for (var i = 0; i < shares.length; i++) {
    if (reconstructed[i].shareCents != shares[i].shareCents) return false;
  }
  return true;
}

({List<BillShareDraft>? shares, String? error}) buildSharesFromMemberState({
  required int totalCents,
  required SplitKind splitKind,
  required CustomSplitMode customMode,
  required List<MemberSplitState> members,
}) {
  final included = members.where((m) => m.included).toList();

  if (included.isEmpty) {
    return (shares: null, error: 'Include at least one person in the split.');
  }

  if (splitKind == SplitKind.equal) {
    final allIncluded = included.length == members.length;
    if (allIncluded) {
      return (shares: null, error: null);
    }
    return (
      shares: equalShareCents(
        totalCents,
        included.map((m) => m.user.id).toList(),
      ),
      error: null,
    );
  }

  if (customMode == CustomSplitMode.amount) {
    final shares = <BillShareDraft>[];
    var sum = 0;

    for (final member in included) {
      final shareCents = parseAmountToCents(member.amount);
      if (shareCents == null) {
        return (
          shares: null,
          error: 'Enter a valid amount for ${member.user.name ?? member.user.email}.',
        );
      }
      shares.add(BillShareDraft(userId: member.user.id, shareCents: shareCents));
      sum += shareCents;
    }

    if (sum != totalCents) {
      return (shares: null, error: 'Custom amounts must add up to the bill total.');
    }

    return (shares: shares, error: null);
  }

  final percentEntries = included.map((member) {
    return (userId: member.user.id, percent: double.tryParse(member.percent) ?? -1);
  }).toList();

  if (percentEntries.any((e) => !e.percent.isFinite || e.percent < 0)) {
    return (shares: null, error: 'Enter a valid percentage for each included person.');
  }

  final percentTotal = percentEntries.fold<double>(0, (sum, e) => sum + e.percent);
  if ((percentTotal - 100).abs() > 0.01) {
    return (shares: null, error: 'Percentages must add up to 100%.');
  }

  return (
    shares: allocateFromPercents(totalCents, percentEntries),
    error: null,
  );
}

({
  List<MemberSplitState> members,
  SplitKind splitKind,
  CustomSplitMode customMode,
}) initializeMemberState(
  List<User> participants, {
  List<BillShareDraft>? existingShares,
  int totalCents = 0,
  SplitKind? splitKind,
  CustomSplitMode? customMode,
}) {
  final shareMap = {
    for (final s in existingShares ?? []) s.userId: s.shareCents,
  };
  final existing = existingShares ?? [];
  final allIncluded = existing.isNotEmpty &&
      participants.every((p) => shareMap.containsKey(p.id));

  var resolvedSplitKind = splitKind ?? SplitKind.equal;
  var resolvedCustomMode = customMode ?? CustomSplitMode.amount;

  if (existing.isNotEmpty && splitKind == null) {
    if (sharesAreEqual(totalCents, existing) && allIncluded) {
      resolvedSplitKind = SplitKind.equal;
    } else {
      resolvedSplitKind = SplitKind.custom;
      resolvedCustomMode =
          inferPercentMode(existing, totalCents) ? CustomSplitMode.percent : CustomSplitMode.amount;
    }
  }

  final members = participants.map((user) {
    final included = shareMap.isNotEmpty ? shareMap.containsKey(user.id) : true;
    final shareCents = shareMap[user.id];
    final amount = shareCents != null ? formatCentsAsAmount(shareCents) : '';
    final percent = shareCents != null && totalCents > 0
        ? ((shareCents / totalCents) * 100).round().toString()
        : '';

    return MemberSplitState(
      user: user,
      included: included,
      amount: amount,
      percent: percent,
    );
  }).toList();

  return (
    members: members,
    splitKind: resolvedSplitKind,
    customMode: resolvedCustomMode,
  );
}

List<MemberSplitState> syncEqualMemberAmounts(
  List<MemberSplitState> members,
  int totalCents,
) {
  final includedIds =
      members.where((m) => m.included).map((m) => m.user.id).toList();
  final shares = equalShareCents(totalCents, includedIds);
  final shareMap = {for (final s in shares) s.userId: s.shareCents};

  return members.map((member) {
    if (!member.included) {
      return member.copyWith(amount: '', percent: '');
    }
    final shareCents = shareMap[member.user.id] ?? 0;
    return member.copyWith(
      amount: formatCentsAsAmount(shareCents),
      percent: totalCents > 0
          ? ((shareCents / totalCents) * 100).round().toString()
          : '',
    );
  }).toList();
}
