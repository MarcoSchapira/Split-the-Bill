import '../models/models.dart';

const _billActivityTypes = {
  'BILL_CREATED',
  'BILL_UPDATED',
  'BILL_SETTLED',
  'BILL_UNSETTLED',
  'BILL_DELETED',
};

const _invitationActivityTypes = {
  'FRIEND_INVITATION_SENT',
  'FRIEND_INVITATION_ACCEPTED',
  'FRIEND_INVITATION_DECLINED',
};

String? activityRoute(ActivityEvent event) {
  if (_billActivityTypes.contains(event.type) && event.billId != null) {
    return '/bills/${event.billId}';
  }

  if (event.type == 'FRIEND_SETTLED' && event.friendshipId != null) {
    return '/friends/${event.friendshipId}';
  }

  if (_invitationActivityTypes.contains(event.type)) {
    return '/friends/invites';
  }

  return null;
}
