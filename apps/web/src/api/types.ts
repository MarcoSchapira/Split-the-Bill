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
