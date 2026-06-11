export type User = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type GroupSummary = {
  id: string;
  name: string;
  createdAt: string;
  role: string;
};

export type GroupMember = {
  id: string;
  role: string;
  joinedAt: string;
  user: User;
};

export type GroupDetail = GroupSummary & {
  members: GroupMember[];
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

export type FriendGroupBill = Bill & {
  pairwise: PairwiseSummary;
};

export type SharedGroupBills = {
  id: string;
  name: string;
  bills: FriendGroupBill[];
};

export type FriendshipDetail = FriendshipSummary & {
  bills: Bill[];
  sharedGroups: SharedGroupBills[];
};

export type BillShare = {
  id: string;
  shareCents: number;
  user: User;
};

export type Bill = {
  id: string;
  description: string;
  incurredAt: string;
  totalCents: number;
  targetType: 'friendship' | 'group';
  friendshipId: string | null;
  groupId: string | null;
  payerId: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  payer: User;
  creator: User;
  group: { id: string; name: string } | null;
  friendship: {
    id: string;
    userA: User;
    userB: User;
  } | null;
  shares: BillShare[];
  canEdit: boolean;
  canDelete: boolean;
  canRetarget: boolean;
};

export type BalanceContact = {
  user: User;
  relationship: 'friend' | 'group';
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
  sender: User;
  recipient: User;
};

export type GroupInvitation = FriendInvitation & {
  group: { id: string; name: string };
};

export type Invitations = {
  receivedFriends: FriendInvitation[];
  sentFriends: FriendInvitation[];
  receivedGroups: GroupInvitation[];
  sentGroups: GroupInvitation[];
};

export type ActivityEvent = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  actor: User;
};
