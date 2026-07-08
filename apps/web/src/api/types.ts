export type User = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
};

export type AuthResponse = {
  user: User;
};

export type FriendshipSummary = {
  id: string;
  createdAt: string;
  friend: User;
};

export type PairwiseSummary = {
  amountCents: number;
  direction: 'friend_owes_you' | 'you_owe_friend';
  yourShareCents: number;
  friendShareCents: number;
};

export type FriendshipDetail = FriendshipSummary & {
  bills: Bill[];
};

export type BillShare = {
  id: string;
  shareCents: number;
  settledAt: string | null;
  user: User;
};

export type BillUserSummary = {
  amountCents: number;
  direction: 'owed_to_you' | 'you_owe' | 'none';
  settled: boolean;
};

export type BillLineItemAssignment = {
  id: string;
  user: User;
};

export type BillLineItem = {
  id: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  sortOrder: number;
  assignments: BillLineItemAssignment[];
};

export type Bill = {
  id: string;
  description: string;
  incurredAt: string;
  totalCents: number;
  targetType: 'friendship' | null;
  source: 'manual' | 'capture';
  friendshipId: string | null;
  storeName: string | null;
  storeAddress: string | null;
  receiptNumber: string | null;
  receiptDate: string | null;
  receiptTime: string | null;
  paymentMethod: string | null;
  cardLast4: string | null;
  itemCount: number | null;
  subtotalCents: number | null;
  otherFeesCents: number | null;
  taxCents: number | null;
  tipCents: number | null;
  payerId: string;
  creatorId: string;
  createdAt: string;
  lastEditedAt: string;
  payer: User;
  creator: User;
  friendship: {
    id: string;
    userA: User;
    userB: User;
  } | null;
  shares: BillShare[];
  canEdit: boolean;
  canDelete: boolean;
  canRetarget: boolean;
  userSummary: BillUserSummary;
  lineItems: BillLineItem[];
};

export type BalanceContact = {
  user: User;
  relationship: 'friend';
  friendshipId?: string;
  balanceCents: number;
};

export type Dashboard = {
  totalOwedToYouCents: number;
  totalYouOweCents: number;
  netBalanceCents: number;
  balances: BalanceContact[];
};

export type InvitationStatus = 'pending' | 'accepted' | 'declined';

export type FriendInvitation = {
  id: string;
  status: InvitationStatus;
  createdAt: string;
  respondedAt: string | null;
  recipientEmail: string | null;
  sender: User;
  recipient: User | null;
};

export type Invitations = {
  receivedFriends: FriendInvitation[];
  sentFriends: FriendInvitation[];
};

export type ActivityBillSummary = {
  id: string;
  description: string;
  incurredAt: string;
  totalCents: number;
};

export type ActivityEvent = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  actor: User;
  billId: string | null;
  friendInvitationId: string | null;
  friendshipId: string | null;
  bill: ActivityBillSummary | null;
};
