import { Prisma } from "../generated/prisma/client";
import { prismaAdmin } from "../db/prisma";
import { withUserContext } from "../db/userContext";
import { ApiError } from "../http/errors";
import {
  sendAccountDeletionVerificationCode,
  sendRegistrationVerificationCode,
  verifyAccountDeletionCode,
  verifyRegistrationCode,
} from "./email-verification.service";
import { signDeletionToken, verifyDeletionToken } from "./deletion-token";
import { sendAccountDeletedConfirmationEmail } from "../email/email.service";
import { claimPendingInvitations } from "../invitations/invitation-claim";
import {
  authenticatedUserSelect,
  type AuthResponse,
  type AuthenticatedUser,
  type ChangePasswordInput,
  type LoginInput,
  type RegisterInput,
  type UpdateProfileInput,
} from "./auth.types";
import { comparePassword, hashPassword } from "./password";
import { createSession, revokeAllSessions, revokeOtherSessions } from "./session.service";
import {
  lockGroupMembershipMutations,
  lockUserAccountMutation,
  transferOrDeleteDepartingCreatorGroup,
} from "../groups/group-ownership";

export const DELETED_ACCOUNT_NAME = "Deleted Account";

export function deletedAccountEmail(userId: string): string {
  return `account-deleted-${userId}@deleted.invalid`;
}

async function buildAuthResponse(userId: string): Promise<AuthResponse> {
  const user = await prismaAdmin.user.findUniqueOrThrow({
    where: { id: userId },
    select: authenticatedUserSelect,
  });
  const session = await createSession(userId);

  return {
    user,
    session: {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    },
  };
}

export async function registerUser(input: RegisterInput): Promise<AuthResponse> {
  const existingUser = await prismaAdmin.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existingUser) {
    throw new ApiError(409, "EMAIL_ALREADY_REGISTERED", "Email is already registered");
  }

  await verifyRegistrationCode(input.email, input.code);

  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prismaAdmin.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        authProvider: "local",
        emailVerifiedAt: new Date(),
      },
      select: authenticatedUserSelect,
    });

    await claimPendingInvitations(user.id, user.email);

    return buildAuthResponse(user.id);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(409, "EMAIL_ALREADY_REGISTERED", "Email is already registered");
    }

    throw error;
  }
}

export { sendRegistrationVerificationCode };

export async function loginUser(input: LoginInput): Promise<AuthResponse> {
  const user = await prismaAdmin.user.findUnique({
    where: { email: input.email },
    select: {
      ...authenticatedUserSelect,
      passwordHash: true,
    },
  });

  if (!user?.passwordHash) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const isValidPassword = await comparePassword(input.password, user.passwordHash);

  if (!isValidPassword) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  await claimPendingInvitations(user.id, user.email);

  return buildAuthResponse(user.id);
}

export async function updateUserProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<AuthenticatedUser> {
  const user = await withUserContext(userId, async (tx) => {
    await lockUserAccountMutation(tx, userId);
    const account = await tx.user.findUnique({
      where: { id: userId },
      select: { authProvider: true },
    });
    if (!account || account.authProvider === "deleted") {
      throw new ApiError(404, "USER_NOT_FOUND", "User not found");
    }

    return tx.user.update({
      where: { id: userId },
      data: { name: input.name },
      select: authenticatedUserSelect,
    });
  });

  return user;
}

export async function recordAiReceiptConsent(
  userId: string,
): Promise<AuthenticatedUser> {
  const user = await withUserContext(userId, async (tx) => {
    await lockUserAccountMutation(tx, userId);
    const existing = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { ...authenticatedUserSelect, authProvider: true },
    });

    if (existing.authProvider === "deleted") {
      throw new ApiError(404, "USER_NOT_FOUND", "User not found");
    }

    if (existing.aiReceiptConsentAt != null) {
      return {
        id: existing.id,
        email: existing.email,
        name: existing.name,
        createdAt: existing.createdAt,
        aiReceiptConsentAt: existing.aiReceiptConsentAt,
      };
    }

    return tx.user.update({
      where: { id: userId },
      data: { aiReceiptConsentAt: new Date() },
      select: authenticatedUserSelect,
    });
  });

  return user;
}

export async function changeUserPassword(
  userId: string,
  sessionId: string,
  input: ChangePasswordInput,
): Promise<void> {
  const user = await withUserContext(userId, (tx) =>
    tx.user.findUnique({
      where: { id: userId },
      select: { authProvider: true, passwordHash: true },
    }),
  );

  if (!user || user.authProvider === "deleted" || !user.passwordHash) {
    throw new ApiError(
      400,
      "PASSWORD_CHANGE_UNAVAILABLE",
      "Password change is not available for this account",
    );
  }

  const isValidPassword = await comparePassword(input.currentPassword, user.passwordHash);

  if (!isValidPassword) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid current password");
  }

  const passwordHash = await hashPassword(input.newPassword);

  await withUserContext(userId, async (tx) => {
    await lockUserAccountMutation(tx, userId);
    const current = await tx.user.findUnique({
      where: { id: userId },
      select: { authProvider: true, passwordHash: true },
    });
    if (!current || current.authProvider === "deleted") {
      throw new ApiError(404, "USER_NOT_FOUND", "User not found");
    }
    if (current.passwordHash !== user.passwordHash) {
      throw new ApiError(409, "ACCOUNT_CHANGED", "Your password changed during this request. Try again");
    }

    await tx.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: { id: true },
    });
  });

  await revokeOtherSessions(userId, sessionId);
}

export async function deleteUserAccount(userId: string): Promise<void> {
  const previousEmail = await prismaAdmin.$transaction(async (tx) => {
    await lockUserAccountMutation(tx, userId);
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, authProvider: true },
    });

    if (!user || user.authProvider === "deleted") {
      throw new ApiError(404, "USER_NOT_FOUND", "User not found");
    }

    const [memberships, initiallyOwnedGroups] = await Promise.all([
      tx.groupMember.findMany({ where: { userId }, select: { groupId: true } }),
      tx.group.findMany({ where: { creatorId: userId }, select: { id: true } }),
    ]);
    await lockGroupMembershipMutations(tx, [
      ...memberships.map((membership) => membership.groupId),
      ...initiallyOwnedGroups.map((group) => group.id),
    ]);

    await tx.friendship.deleteMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
    });

    await tx.friendInvitation.deleteMany({
      where: {
        OR: [{ senderId: userId }, { recipientId: userId }],
      },
    });

    // Ownership may have changed while the transaction waited for locks.
    // Choose successors from a fresh, serialized view.
    const ownedGroups = await tx.group.findMany({
      where: { creatorId: userId },
      select: { id: true },
    });

    for (const group of ownedGroups) {
      await transferOrDeleteDepartingCreatorGroup(tx, group.id, userId);
    }

    await tx.groupMember.deleteMany({ where: { userId } });

    await tx.activityRecipient.deleteMany({
      where: { userId },
    });

    await tx.bill.deleteMany({
      where: {
        creatorId: userId,
        isSplitWithFriends: false,
        isSplitWithGroup: false,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        name: DELETED_ACCOUNT_NAME,
        email: deletedAccountEmail(userId),
        passwordHash: null,
        providerUserId: null,
        emailVerifiedAt: null,
        authProvider: "deleted",
      },
    });

    return user.email;
  });

  await revokeAllSessions(userId);

  await prismaAdmin.emailVerification.deleteMany({
    where: { email: previousEmail },
  });

  await sendAccountDeletedConfirmationEmail(previousEmail);
}

export async function requestAccountDeletionCode(email: string): Promise<void> {
  await sendAccountDeletionVerificationCode(email);
}

export async function verifyAccountDeletionRequest(
  email: string,
  code: string,
): Promise<string> {
  const normalizedEmail = email.toLowerCase();

  await verifyAccountDeletionCode(normalizedEmail, code);

  const user = await prismaAdmin.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, authProvider: true },
  });

  if (!user || user.authProvider === "deleted") {
    throw new ApiError(
      400,
      "VERIFICATION_CODE_INVALID",
      "Verification code is invalid or expired",
    );
  }

  return signDeletionToken({ userId: user.id, email: normalizedEmail });
}

export async function confirmAccountDeletion(deletionToken: string): Promise<void> {
  const payload = verifyDeletionToken(deletionToken);

  const user = await prismaAdmin.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, authProvider: true },
  });

  if (!user || user.authProvider === "deleted" || user.email !== payload.email) {
    throw new ApiError(400, "DELETION_TOKEN_INVALID", "Deletion request is invalid or expired");
  }

  await deleteUserAccount(user.id);
}
