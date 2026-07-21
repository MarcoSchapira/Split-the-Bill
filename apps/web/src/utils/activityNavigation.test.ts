import { describe, expect, it } from 'vitest'
import type { ActivityEvent } from '../api/types'
import { activityRoute } from './activityNavigation'

function event(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: 'event-1',
    type: 'BILL_CREATED',
    message: 'added a bill.',
    createdAt: '2026-07-21T12:00:00.000Z',
    actor: { id: 'user-1', email: 'person@example.com', name: 'Person', createdAt: '2026-07-01T12:00:00.000Z' },
    billId: 'bill-1',
    friendInvitationId: null,
    friendshipId: null,
    groupId: null,
    bill: { id: 'bill-1', description: 'Lunch', incurredAt: '2026-07-21T00:00:00.000Z', totalCents: 2400 },
    ...overrides,
  }
}

describe('activityRoute', () => {
  it('links active bill events to bill detail', () => {
    expect(activityRoute(event())).toBe('/bills/bill-1')
  })

  it('does not link a deleted bill to a missing detail page', () => {
    expect(activityRoute(event({ type: 'BILL_DELETED' }))).toBeNull()
  })

  it('routes invitations to the People invitation tab', () => {
    expect(activityRoute(event({ type: 'FRIEND_INVITATION_SENT', billId: null, bill: null }))).toBe('/friends?tab=invitations')
  })

  it('links live group activity but not deleted groups', () => {
    const groupEvent = event({ type: 'GROUP_MEMBER_ADDED', billId: null, bill: null })
    groupEvent.groupId = 'group-1'
    expect(activityRoute(groupEvent)).toBe('/groups/group-1')
    groupEvent.type = 'GROUP_DELETED'
    expect(activityRoute(groupEvent)).toBeNull()
  })
})
