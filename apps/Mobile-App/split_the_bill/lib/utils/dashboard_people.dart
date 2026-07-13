import '../models/models.dart';
import 'format.dart';

class DashboardPerson {
  const DashboardPerson({required this.friendship, required this.balanceCents});

  final FriendshipSummary friendship;
  final int balanceCents;
}

List<DashboardPerson> buildDashboardPeople({
  required List<FriendshipSummary> friends,
  required Dashboard dashboard,
}) {
  final balancesByFriendshipId = {
    for (final balance in dashboard.balances)
      if (balance.friendshipId != null) balance.friendshipId!: balance.balanceCents,
  };

  final people = friends
      .map(
        (friendship) => DashboardPerson(
          friendship: friendship,
          balanceCents: balancesByFriendshipId[friendship.id] ?? 0,
        ),
      )
      .toList();

  people.sort((a, b) {
    final byAbsoluteBalance = b.balanceCents.abs().compareTo(a.balanceCents.abs());
    if (byAbsoluteBalance != 0) return byAbsoluteBalance;
    return displayName(a.friendship.friend).compareTo(displayName(b.friendship.friend));
  });

  return people;
}
