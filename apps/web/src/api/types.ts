export type User = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  aiReceiptConsentAt?: string | null;
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
  payerMarkedAsPaid: boolean;
  lenderConfirmedPaid: boolean;
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
  source: 'manual' | 'capture';
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
  shares: BillShare[];
  canEdit: boolean;
  canDelete: boolean;
  canRetarget: boolean;
  userSummary: BillUserSummary;
  lineItems: BillLineItem[];
  isOneMainTotal?: boolean;
  isSplitWithFriends?: boolean;
  isSplitByFinalAmounts?: boolean;
  isSplitWithGroup?: boolean;
  groupId?: string | null;
  group?: BillGroupSummary | null;
  pairwise?: PairwiseSummary;
};

export type GroupIconKey =
  | 'home'
  | 'trip'
  | 'food'
  | 'groceries'
  | 'rent'
  | 'utilities'
  | 'entertainment'
  | 'sports'
  | 'pets'
  | 'family'
  | 'work'
  | 'other';

export const GROUP_ICON_KEYS: GroupIconKey[] = [
  'home',
  'trip',
  'food',
  'groceries',
  'rent',
  'utilities',
  'entertainment',
  'sports',
  'pets',
  'family',
  'work',
  'other',
];

export type BillGroupSummary = {
  id: string;
  name: string;
  iconKey: GroupIconKey;
};

export type GroupSummary = {
  id: string;
  name: string;
  iconKey: GroupIconKey;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  memberPreview: User[];
  netBalanceCents: number;
};

export type GroupMemberDetail = {
  id: string;
  joinedAt: string;
  user: User;
  isCreator: boolean;
};

export type GroupDetail = GroupSummary & {
  creator: User;
  members: GroupMemberDetail[];
  bills: Bill[];
  billCount: number;
  hasExistingBills: boolean;
  unsettledBillCount: number;
  totalGroupSpendCents: number;
};

export type GroupBalanceSummary = {
  group: BillGroupSummary;
  balanceCents: number;
};

export type BalanceContact = {
  user: User;
  relationship: 'friend' | 'group';
  friendshipId?: string;
  groupId?: string;
  balanceCents: number;
};

export type Dashboard = {
  totalOwedToYouCents: number;
  totalYouOweCents: number;
  netBalanceCents: number;
  balances: BalanceContact[];
  groupBalances: GroupBalanceSummary[];
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
