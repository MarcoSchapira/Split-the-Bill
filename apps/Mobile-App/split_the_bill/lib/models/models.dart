import 'user.dart';

enum TargetType { friendship, group }

enum InvitationStatus { pending, accepted, declined }

class GroupRef {
  const GroupRef({required this.id, required this.name});

  final String id;
  final String name;

  factory GroupRef.fromJson(Map<String, dynamic> json) {
    return GroupRef(
      id: json['id'] as String,
      name: json['name'] as String,
    );
  }
}

class GroupSummary {
  const GroupSummary({
    required this.id,
    required this.name,
    required this.createdAt,
    required this.role,
  });

  final String id;
  final String name;
  final String createdAt;
  final String role;

  factory GroupSummary.fromJson(Map<String, dynamic> json) {
    return GroupSummary(
      id: json['id'] as String,
      name: json['name'] as String,
      createdAt: json['createdAt'] as String,
      role: json['role'] as String,
    );
  }
}

class GroupMember {
  const GroupMember({
    required this.id,
    required this.role,
    required this.joinedAt,
    required this.user,
  });

  final String id;
  final String role;
  final String joinedAt;
  final User user;

  factory GroupMember.fromJson(Map<String, dynamic> json) {
    return GroupMember(
      id: json['id'] as String,
      role: json['role'] as String,
      joinedAt: json['joinedAt'] as String,
      user: User.fromJson(json['user'] as Map<String, dynamic>),
    );
  }
}

class GroupDetail extends GroupSummary {
  const GroupDetail({
    required super.id,
    required super.name,
    required super.createdAt,
    required super.role,
    required this.members,
  });

  final List<GroupMember> members;

  factory GroupDetail.fromJson(Map<String, dynamic> json) {
    return GroupDetail(
      id: json['id'] as String,
      name: json['name'] as String,
      createdAt: json['createdAt'] as String,
      role: json['role'] as String,
      members: (json['members'] as List<dynamic>)
          .map((e) => GroupMember.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class FriendshipSummary {
  const FriendshipSummary({
    required this.id,
    required this.createdAt,
    required this.friend,
  });

  final String id;
  final String createdAt;
  final User friend;

  factory FriendshipSummary.fromJson(Map<String, dynamic> json) {
    return FriendshipSummary(
      id: json['id'] as String,
      createdAt: json['createdAt'] as String,
      friend: User.fromJson(json['friend'] as Map<String, dynamic>),
    );
  }
}

class PairwiseSummary {
  const PairwiseSummary({
    required this.amountCents,
    required this.direction,
    required this.yourShareCents,
    required this.friendShareCents,
  });

  final int amountCents;
  final String direction;
  final int yourShareCents;
  final int friendShareCents;

  factory PairwiseSummary.fromJson(Map<String, dynamic> json) {
    return PairwiseSummary(
      amountCents: json['amountCents'] as int,
      direction: json['direction'] as String,
      yourShareCents: json['yourShareCents'] as int,
      friendShareCents: json['friendShareCents'] as int,
    );
  }
}

class BillShare {
  const BillShare({
    required this.id,
    required this.shareCents,
    required this.user,
    this.settledAt,
  });

  final String id;
  final int shareCents;
  final User user;
  final String? settledAt;

  factory BillShare.fromJson(Map<String, dynamic> json) {
    return BillShare(
      id: json['id'] as String,
      shareCents: json['shareCents'] as int,
      user: User.fromJson(json['user'] as Map<String, dynamic>),
      settledAt: json['settledAt'] as String?,
    );
  }
}

class BillUserSummary {
  const BillUserSummary({
    required this.amountCents,
    required this.direction,
    required this.settled,
  });

  final int amountCents;
  final String direction;
  final bool settled;

  factory BillUserSummary.fromJson(Map<String, dynamic> json) {
    return BillUserSummary(
      amountCents: json['amountCents'] as int,
      direction: json['direction'] as String,
      settled: json['settled'] as bool,
    );
  }
}

enum BillSource { manual, capture }

class Bill {
  const Bill({
    required this.id,
    required this.description,
    required this.incurredAt,
    required this.totalCents,
    required this.targetType,
    required this.source,
    required this.friendshipId,
    required this.groupId,
    required this.payerId,
    required this.creatorId,
    required this.createdAt,
    required this.lastEditedAt,
    required this.payer,
    required this.creator,
    required this.group,
    required this.friendship,
    required this.shares,
    required this.canEdit,
    required this.canDelete,
    required this.canRetarget,
    required this.userSummary,
    this.pairwise,
  });

  final String id;
  final String description;
  final String incurredAt;
  final int totalCents;
  final TargetType targetType;
  final BillSource source;
  final String? friendshipId;
  final String? groupId;
  final String payerId;
  final String creatorId;
  final String createdAt;
  final String lastEditedAt;
  final User payer;
  final User creator;
  final GroupRef? group;
  final Map<String, dynamic>? friendship;
  final List<BillShare> shares;
  final bool canEdit;
  final bool canDelete;
  final bool canRetarget;
  final BillUserSummary userSummary;
  final PairwiseSummary? pairwise;

  factory Bill.fromJson(Map<String, dynamic> json) {
    return Bill(
      id: json['id'] as String,
      description: json['description'] as String,
      incurredAt: json['incurredAt'] as String,
      totalCents: json['totalCents'] as int,
      targetType: json['targetType'] == 'group'
          ? TargetType.group
          : TargetType.friendship,
      source: json['source'] == 'capture' ? BillSource.capture : BillSource.manual,
      friendshipId: json['friendshipId'] as String?,
      groupId: json['groupId'] as String?,
      payerId: json['payerId'] as String,
      creatorId: json['creatorId'] as String,
      createdAt: json['createdAt'] as String,
      lastEditedAt: json['lastEditedAt'] as String,
      payer: User.fromJson(json['payer'] as Map<String, dynamic>),
      creator: User.fromJson(json['creator'] as Map<String, dynamic>),
      group: json['group'] != null
          ? GroupRef.fromJson(json['group'] as Map<String, dynamic>)
          : null,
      friendship: json['friendship'] as Map<String, dynamic>?,
      shares: (json['shares'] as List<dynamic>)
          .map((e) => BillShare.fromJson(e as Map<String, dynamic>))
          .toList(),
      canEdit: json['canEdit'] as bool,
      canDelete: json['canDelete'] as bool,
      canRetarget: json['canRetarget'] as bool,
      userSummary: BillUserSummary.fromJson(
        json['userSummary'] as Map<String, dynamic>,
      ),
      pairwise: json['pairwise'] != null
          ? PairwiseSummary.fromJson(json['pairwise'] as Map<String, dynamic>)
          : null,
    );
  }
}

class FriendshipDetail extends FriendshipSummary {
  const FriendshipDetail({
    required super.id,
    required super.createdAt,
    required super.friend,
    required this.bills,
    required this.sharedGroups,
  });

  final List<Bill> bills;
  final List<SharedGroupBills> sharedGroups;

  factory FriendshipDetail.fromJson(Map<String, dynamic> json) {
    return FriendshipDetail(
      id: json['id'] as String,
      createdAt: json['createdAt'] as String,
      friend: User.fromJson(json['friend'] as Map<String, dynamic>),
      bills: (json['bills'] as List<dynamic>)
          .map((e) => Bill.fromJson(e as Map<String, dynamic>))
          .toList(),
      sharedGroups: (json['sharedGroups'] as List<dynamic>)
          .map((e) => SharedGroupBills.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class SharedGroupBills {
  const SharedGroupBills({
    required this.id,
    required this.name,
    required this.bills,
  });

  final String id;
  final String name;
  final List<Bill> bills;

  factory SharedGroupBills.fromJson(Map<String, dynamic> json) {
    return SharedGroupBills(
      id: json['id'] as String,
      name: json['name'] as String,
      bills: (json['bills'] as List<dynamic>)
          .map((e) => Bill.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class BalanceContact {
  const BalanceContact({
    required this.user,
    required this.relationship,
    required this.balanceCents,
    this.friendshipId,
  });

  final User user;
  final String relationship;
  final String? friendshipId;
  final int balanceCents;

  factory BalanceContact.fromJson(Map<String, dynamic> json) {
    return BalanceContact(
      user: User.fromJson(json['user'] as Map<String, dynamic>),
      relationship: json['relationship'] as String,
      friendshipId: json['friendshipId'] as String?,
      balanceCents: json['balanceCents'] as int,
    );
  }
}

class Dashboard {
  const Dashboard({
    required this.totalOwedToYouCents,
    required this.totalYouOweCents,
    required this.netBalanceCents,
    required this.balances,
  });

  final int totalOwedToYouCents;
  final int totalYouOweCents;
  final int netBalanceCents;
  final List<BalanceContact> balances;

  factory Dashboard.fromJson(Map<String, dynamic> json) {
    return Dashboard(
      totalOwedToYouCents: json['totalOwedToYouCents'] as int,
      totalYouOweCents: json['totalYouOweCents'] as int,
      netBalanceCents: json['netBalanceCents'] as int,
      balances: (json['balances'] as List<dynamic>)
          .map((e) => BalanceContact.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class FriendInvitation {
  const FriendInvitation({
    required this.id,
    required this.status,
    required this.createdAt,
    required this.respondedAt,
    required this.recipientEmail,
    required this.sender,
    required this.recipient,
    this.group,
  });

  final String id;
  final InvitationStatus status;
  final String createdAt;
  final String? respondedAt;
  final String? recipientEmail;
  final User sender;
  final User? recipient;
  final GroupRef? group;

  factory FriendInvitation.fromJson(Map<String, dynamic> json) {
    return FriendInvitation(
      id: json['id'] as String,
      status: _parseStatus(json['status'] as String),
      createdAt: json['createdAt'] as String,
      respondedAt: json['respondedAt'] as String?,
      recipientEmail: json['recipientEmail'] as String?,
      sender: User.fromJson(json['sender'] as Map<String, dynamic>),
      recipient: json['recipient'] != null
          ? User.fromJson(json['recipient'] as Map<String, dynamic>)
          : null,
      group: json['group'] != null
          ? GroupRef.fromJson(json['group'] as Map<String, dynamic>)
          : null,
    );
  }
}

class GroupInvitation extends FriendInvitation {
  const GroupInvitation({
    required super.id,
    required super.status,
    required super.createdAt,
    required super.respondedAt,
    required super.recipientEmail,
    required super.sender,
    required super.recipient,
    required GroupRef group,
  }) : super(group: group);

  GroupRef get groupRef => group!;

  factory GroupInvitation.fromJson(Map<String, dynamic> json) {
    return GroupInvitation(
      id: json['id'] as String,
      status: _parseStatus(json['status'] as String),
      createdAt: json['createdAt'] as String,
      respondedAt: json['respondedAt'] as String?,
      recipientEmail: json['recipientEmail'] as String?,
      sender: User.fromJson(json['sender'] as Map<String, dynamic>),
      recipient: json['recipient'] != null
          ? User.fromJson(json['recipient'] as Map<String, dynamic>)
          : null,
      group: GroupRef.fromJson(json['group'] as Map<String, dynamic>),
    );
  }
}

class Invitations {
  const Invitations({
    required this.receivedFriends,
    required this.sentFriends,
    required this.receivedGroups,
    required this.sentGroups,
  });

  final List<FriendInvitation> receivedFriends;
  final List<FriendInvitation> sentFriends;
  final List<GroupInvitation> receivedGroups;
  final List<GroupInvitation> sentGroups;

  factory Invitations.fromJson(Map<String, dynamic> json) {
    return Invitations(
      receivedFriends: (json['receivedFriends'] as List<dynamic>)
          .map((e) => FriendInvitation.fromJson(e as Map<String, dynamic>))
          .toList(),
      sentFriends: (json['sentFriends'] as List<dynamic>)
          .map((e) => FriendInvitation.fromJson(e as Map<String, dynamic>))
          .toList(),
      receivedGroups: (json['receivedGroups'] as List<dynamic>)
          .map((e) => GroupInvitation.fromJson(e as Map<String, dynamic>))
          .toList(),
      sentGroups: (json['sentGroups'] as List<dynamic>)
          .map((e) => GroupInvitation.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class ActivityEvent {
  const ActivityEvent({
    required this.id,
    required this.type,
    required this.message,
    required this.createdAt,
    required this.actor,
  });

  final String id;
  final String type;
  final String message;
  final String createdAt;
  final User actor;

  factory ActivityEvent.fromJson(Map<String, dynamic> json) {
    return ActivityEvent(
      id: json['id'] as String,
      type: json['type'] as String,
      message: json['message'] as String,
      createdAt: json['createdAt'] as String,
      actor: User.fromJson(json['actor'] as Map<String, dynamic>),
    );
  }
}

InvitationStatus _parseStatus(String value) {
  return InvitationStatus.values.firstWhere(
    (s) => s.name == value,
    orElse: () => InvitationStatus.pending,
  );
}

class AuthTokens {
  const AuthTokens({
    required this.accessToken,
    required this.refreshToken,
  });

  final String accessToken;
  final String refreshToken;
}

class AuthResponse {
  const AuthResponse({
    required this.user,
    required this.tokens,
  });

  final User user;
  final AuthTokens tokens;
}
