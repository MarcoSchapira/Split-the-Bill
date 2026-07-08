import type { ActivityEvent } from '../api/types'

const billActivityTypes = new Set([
  'BILL_CREATED',
  'BILL_UPDATED',
  'BILL_SETTLED',
  'BILL_UNSETTLED',
  'BILL_DELETED',
])

const invitationActivityTypes = new Set([
  'FRIEND_INVITATION_SENT',
  'FRIEND_INVITATION_ACCEPTED',
  'FRIEND_INVITATION_DECLINED',
])

export function activityRoute(event: ActivityEvent): string | null {
  if (billActivityTypes.has(event.type) && event.billId) {
    return `/bills/${event.billId}`
  }

  if (event.type === 'FRIEND_SETTLED' && event.friendshipId) {
    return `/friends/${event.friendshipId}`
  }

  if (invitationActivityTypes.has(event.type)) {
    return '/invitations'
  }

  return null
}

export function activityIsNavigable(event: ActivityEvent): boolean {
  return activityRoute(event) !== null
}
