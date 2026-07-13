import 'user.dart';

enum InvitationStatus { pending, accepted, declined }

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
    required this.lenderId,
    required this.user,
    required this.payerMarkedAsPaid,
    required this.lenderConfirmedPaid,
  });

  final String id;
  final int shareCents;
  final String lenderId;
  final User user;
  final bool payerMarkedAsPaid;
  final bool lenderConfirmedPaid;

  factory BillShare.fromJson(Map<String, dynamic> json) {
    return BillShare(
      id: json['id'] as String,
      shareCents: json['shareCents'] as int,
      lenderId: json['lenderId'] as String,
      user: User.fromJson(json['user'] as Map<String, dynamic>),
      payerMarkedAsPaid: json['payerMarkedAsPaid'] as bool? ?? false,
      lenderConfirmedPaid: json['lenderConfirmedPaid'] as bool? ?? false,
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

class BillLineItemAssignment {
  const BillLineItemAssignment({required this.id, required this.user});

  final String id;
  final User user;

  factory BillLineItemAssignment.fromJson(Map<String, dynamic> json) {
    return BillLineItemAssignment(
      id: json['id'] as String,
      user: User.fromJson(json['user'] as Map<String, dynamic>),
    );
  }
}

class BillLineItem {
  const BillLineItem({
    required this.id,
    required this.name,
    required this.quantity,
    required this.unitPriceCents,
    required this.totalPriceCents,
    required this.sortOrder,
    required this.assignments,
  });

  final String id;
  final String name;
  final double quantity;
  final int unitPriceCents;
  final int totalPriceCents;
  final int sortOrder;
  final List<BillLineItemAssignment> assignments;

  static double _parseQuantity(dynamic raw) {
    if (raw is num) {
      return raw.toDouble();
    }

    if (raw is String) {
      final parsed = double.tryParse(raw);
      if (parsed != null) {
        return parsed;
      }
    }

    throw FormatException('Invalid bill line item quantity: $raw');
  }

  factory BillLineItem.fromJson(Map<String, dynamic> json) {
    return BillLineItem(
      id: json['id'] as String,
      name: json['name'] as String,
      quantity: _parseQuantity(json['quantity']),
      unitPriceCents: json['unitPriceCents'] as int,
      totalPriceCents: json['totalPriceCents'] as int,
      sortOrder: json['sortOrder'] as int,
      assignments: (json['assignments'] as List<dynamic>)
          .map(
            (e) => BillLineItemAssignment.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    );
  }
}

class Bill {
  const Bill({
    required this.id,
    required this.description,
    required this.incurredAt,
    required this.totalCents,
    required this.source,
    required this.storeName,
    required this.storeAddress,
    required this.receiptNumber,
    required this.receiptDate,
    required this.receiptTime,
    required this.paymentMethod,
    required this.cardLast4,
    required this.itemCount,
    required this.subtotalCents,
    required this.otherFeesCents,
    required this.taxCents,
    required this.tipCents,
    required this.payerId,
    required this.creatorId,
    required this.createdAt,
    required this.lastEditedAt,
    required this.payer,
    required this.creator,
    required this.shares,
    required this.canEdit,
    required this.canDelete,
    required this.canRetarget,
    required this.userSummary,
    required this.lineItems,
    required this.isOneMainTotal,
    required this.isSplitWithFriends,
    required this.isSplitByFinalAmounts,
    required this.isSplitWithGroup,
    this.groupId,
    this.group,
    this.pairwise,
  });

  final String id;
  final String description;
  final String incurredAt;
  final int totalCents;
  final BillSource source;
  final String? storeName;
  final String? storeAddress;
  final String? receiptNumber;
  final String? receiptDate;
  final String? receiptTime;
  final String? paymentMethod;
  final String? cardLast4;
  final int? itemCount;
  final int? subtotalCents;
  final int? otherFeesCents;
  final int? taxCents;
  final int? tipCents;
  final String payerId;
  final String creatorId;
  final String createdAt;
  final String lastEditedAt;
  final User payer;
  final User creator;
  final List<BillShare> shares;
  final bool canEdit;
  final bool canDelete;
  final bool canRetarget;
  final BillUserSummary userSummary;
  final List<BillLineItem> lineItems;
  final bool isOneMainTotal;
  final bool isSplitWithFriends;
  final bool isSplitByFinalAmounts;
  final bool isSplitWithGroup;
  final String? groupId;
  final BillGroupSummary? group;
  final PairwiseSummary? pairwise;

  factory Bill.fromJson(Map<String, dynamic> json) {
    final shares = (json['shares'] as List<dynamic>)
        .map((e) => BillShare.fromJson(e as Map<String, dynamic>))
        .toList();
    final lineItems = (json['lineItems'] as List<dynamic>? ?? const [])
        .map((e) => BillLineItem.fromJson(e as Map<String, dynamic>))
        .toList();
    final hasLineItemAssignments = lineItems.any(
      (item) => item.assignments.isNotEmpty,
    );

    return Bill(
      id: json['id'] as String,
      description: json['description'] as String,
      incurredAt: json['incurredAt'] as String,
      totalCents: json['totalCents'] as int,
      source: json['source'] == 'capture'
          ? BillSource.capture
          : BillSource.manual,
      storeName: json['storeName'] as String?,
      storeAddress: json['storeAddress'] as String?,
      receiptNumber: json['receiptNumber'] as String?,
      receiptDate: json['receiptDate'] as String?,
      receiptTime: json['receiptTime'] as String?,
      paymentMethod: json['paymentMethod'] as String?,
      cardLast4: json['cardLast4'] as String?,
      itemCount: json['itemCount'] as int?,
      subtotalCents: json['subtotalCents'] as int?,
      otherFeesCents: json['otherFeesCents'] as int?,
      taxCents: json['taxCents'] as int?,
      tipCents: json['tipCents'] as int?,
      payerId: json['payerId'] as String,
      creatorId: json['creatorId'] as String,
      createdAt: json['createdAt'] as String,
      lastEditedAt: json['lastEditedAt'] as String,
      payer: User.fromJson(json['payer'] as Map<String, dynamic>),
      creator: User.fromJson(json['creator'] as Map<String, dynamic>),
      shares: shares,
      canEdit: json['canEdit'] as bool,
      canDelete: json['canDelete'] as bool,
      canRetarget: json['canRetarget'] as bool,
      userSummary: BillUserSummary.fromJson(
        json['userSummary'] as Map<String, dynamic>,
      ),
      lineItems: lineItems,
      isOneMainTotal: json['isOneMainTotal'] as bool? ?? lineItems.isEmpty,
      isSplitWithFriends:
          json['isSplitWithFriends'] as bool? ?? shares.length > 1,
      isSplitByFinalAmounts:
          json['isSplitByFinalAmounts'] as bool? ?? !hasLineItemAssignments,
      isSplitWithGroup: json['isSplitWithGroup'] as bool? ?? false,
      groupId: json['groupId'] as String?,
      group: json['group'] != null
          ? BillGroupSummary.fromJson(json['group'] as Map<String, dynamic>)
          : null,
      pairwise: json['pairwise'] != null
          ? PairwiseSummary.fromJson(json['pairwise'] as Map<String, dynamic>)
          : null,
    );
  }
}

class BillGroupSummary {
  const BillGroupSummary({
    required this.id,
    required this.name,
    required this.iconKey,
  });

  final String id;
  final String name;
  final String iconKey;

  factory BillGroupSummary.fromJson(Map<String, dynamic> json) {
    return BillGroupSummary(
      id: json['id'] as String,
      name: json['name'] as String,
      iconKey: json['iconKey'] as String,
    );
  }
}

class GroupSummary {
  const GroupSummary({
    required this.id,
    required this.name,
    required this.iconKey,
    required this.creatorId,
    required this.createdAt,
    required this.updatedAt,
    required this.memberCount,
    required this.memberPreview,
    required this.netBalanceCents,
  });

  final String id;
  final String name;
  final String iconKey;
  final String creatorId;
  final String createdAt;
  final String updatedAt;
  final int memberCount;
  final List<User> memberPreview;
  final int netBalanceCents;

  factory GroupSummary.fromJson(Map<String, dynamic> json) {
    return GroupSummary(
      id: json['id'] as String,
      name: json['name'] as String,
      iconKey: json['iconKey'] as String,
      creatorId: json['creatorId'] as String,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
      memberCount: json['memberCount'] as int,
      memberPreview: (json['memberPreview'] as List<dynamic>? ?? const [])
          .map((e) => User.fromJson(e as Map<String, dynamic>))
          .toList(),
      netBalanceCents: json['netBalanceCents'] as int? ?? 0,
    );
  }
}

class GroupMemberDetail {
  const GroupMemberDetail({
    required this.id,
    required this.joinedAt,
    required this.user,
    required this.isCreator,
  });

  final String id;
  final String joinedAt;
  final User user;
  final bool isCreator;

  factory GroupMemberDetail.fromJson(Map<String, dynamic> json) {
    return GroupMemberDetail(
      id: json['id'] as String,
      joinedAt: json['joinedAt'] as String,
      user: User.fromJson(json['user'] as Map<String, dynamic>),
      isCreator: json['isCreator'] as bool? ?? false,
    );
  }
}

class GroupDetail {
  const GroupDetail({
    required this.id,
    required this.name,
    required this.iconKey,
    required this.creatorId,
    required this.createdAt,
    required this.updatedAt,
    required this.creator,
    required this.members,
    required this.bills,
    required this.billCount,
    required this.hasExistingBills,
    required this.unsettledBillCount,
    required this.netBalanceCents,
    required this.totalGroupSpendCents,
  });

  final String id;
  final String name;
  final String iconKey;
  final String creatorId;
  final String createdAt;
  final String updatedAt;
  final User creator;
  final List<GroupMemberDetail> members;
  final List<Bill> bills;
  final int billCount;
  final bool hasExistingBills;
  final int unsettledBillCount;
  final int netBalanceCents;
  final int totalGroupSpendCents;

  factory GroupDetail.fromJson(Map<String, dynamic> json) {
    return GroupDetail(
      id: json['id'] as String,
      name: json['name'] as String,
      iconKey: json['iconKey'] as String,
      creatorId: json['creatorId'] as String,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
      creator: User.fromJson(json['creator'] as Map<String, dynamic>),
      members: (json['members'] as List<dynamic>)
          .map((e) => GroupMemberDetail.fromJson(e as Map<String, dynamic>))
          .toList(),
      bills: (json['bills'] as List<dynamic>)
          .map((e) => Bill.fromJson(e as Map<String, dynamic>))
          .toList(),
      billCount: json['billCount'] as int? ?? 0,
      hasExistingBills: json['hasExistingBills'] as bool? ?? false,
      unsettledBillCount: json['unsettledBillCount'] as int? ?? 0,
      netBalanceCents: json['netBalanceCents'] as int? ?? 0,
      totalGroupSpendCents: json['totalGroupSpendCents'] as int? ?? 0,
    );
  }
}

class GroupBalanceSummary {
  const GroupBalanceSummary({
    required this.group,
    required this.balanceCents,
  });

  final BillGroupSummary group;
  final int balanceCents;

  factory GroupBalanceSummary.fromJson(Map<String, dynamic> json) {
    return GroupBalanceSummary(
      group: BillGroupSummary.fromJson(json['group'] as Map<String, dynamic>),
      balanceCents: json['balanceCents'] as int,
    );
  }
}

class FriendshipDetail extends FriendshipSummary {
  const FriendshipDetail({
    required super.id,
    required super.createdAt,
    required super.friend,
    required this.bills,
  });

  final List<Bill> bills;

  factory FriendshipDetail.fromJson(Map<String, dynamic> json) {
    return FriendshipDetail(
      id: json['id'] as String,
      createdAt: json['createdAt'] as String,
      friend: User.fromJson(json['friend'] as Map<String, dynamic>),
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
    required this.owedToYouPendingConfirmationPercent,
    required this.youOwePendingConfirmationPercent,
    required this.balances,
    required this.groupBalances,
  });

  final int totalOwedToYouCents;
  final int totalYouOweCents;
  final int netBalanceCents;
  final int? owedToYouPendingConfirmationPercent;
  final int? youOwePendingConfirmationPercent;
  final List<BalanceContact> balances;
  final List<GroupBalanceSummary> groupBalances;

  factory Dashboard.fromJson(Map<String, dynamic> json) {
    return Dashboard(
      totalOwedToYouCents: json['totalOwedToYouCents'] as int,
      totalYouOweCents: json['totalYouOweCents'] as int,
      netBalanceCents: json['netBalanceCents'] as int,
      owedToYouPendingConfirmationPercent:
          json['owedToYouPendingConfirmationPercent'] as int?,
      youOwePendingConfirmationPercent:
          json['youOwePendingConfirmationPercent'] as int?,
      balances: (json['balances'] as List<dynamic>)
          .map((e) => BalanceContact.fromJson(e as Map<String, dynamic>))
          .toList(),
      groupBalances: (json['groupBalances'] as List<dynamic>? ?? const [])
          .map((e) => GroupBalanceSummary.fromJson(e as Map<String, dynamic>))
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
  });

  final String id;
  final InvitationStatus status;
  final String createdAt;
  final String? respondedAt;
  final String? recipientEmail;
  final User sender;
  final User? recipient;

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
    );
  }
}

class Invitations {
  const Invitations({required this.receivedFriends, required this.sentFriends});

  final List<FriendInvitation> receivedFriends;
  final List<FriendInvitation> sentFriends;

  factory Invitations.fromJson(Map<String, dynamic> json) {
    return Invitations(
      receivedFriends: (json['receivedFriends'] as List<dynamic>)
          .map((e) => FriendInvitation.fromJson(e as Map<String, dynamic>))
          .toList(),
      sentFriends: (json['sentFriends'] as List<dynamic>)
          .map((e) => FriendInvitation.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class ActivityBillSummary {
  const ActivityBillSummary({
    required this.id,
    required this.description,
    required this.incurredAt,
    required this.totalCents,
  });

  final String id;
  final String description;
  final String incurredAt;
  final int totalCents;

  factory ActivityBillSummary.fromJson(Map<String, dynamic> json) {
    return ActivityBillSummary(
      id: json['id'] as String,
      description: json['description'] as String,
      incurredAt: json['incurredAt'] as String,
      totalCents: json['totalCents'] as int,
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
    this.billId,
    this.friendInvitationId,
    this.friendshipId,
    this.bill,
  });

  final String id;
  final String type;
  final String message;
  final String createdAt;
  final User actor;
  final String? billId;
  final String? friendInvitationId;
  final String? friendshipId;
  final ActivityBillSummary? bill;

  factory ActivityEvent.fromJson(Map<String, dynamic> json) {
    return ActivityEvent(
      id: json['id'] as String,
      type: json['type'] as String,
      message: json['message'] as String,
      createdAt: json['createdAt'] as String,
      actor: User.fromJson(json['actor'] as Map<String, dynamic>),
      billId: json['billId'] as String?,
      friendInvitationId: json['friendInvitationId'] as String?,
      friendshipId: json['friendshipId'] as String?,
      bill: json['bill'] == null
          ? null
          : ActivityBillSummary.fromJson(json['bill'] as Map<String, dynamic>),
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
  const AuthTokens({required this.accessToken, required this.refreshToken});

  final String accessToken;
  final String refreshToken;
}

class AuthResponse {
  const AuthResponse({required this.user, required this.tokens});

  final User user;
  final AuthTokens tokens;
}
