import { Prisma } from "../generated/prisma/client";
import { prismaAdmin } from "../db/prisma";
import { withUserContext } from "../db/userContext";
import { ApiError } from "../http/errors";
import {
  sendRegistrationVerificationCode,
  verifyRegistrationCode,
} from "./email-verification.service";
import { claimPendingInvitations } from "../invitations/invitation-claim";
import {
  safeUserSelect,
  type AuthResponse,
  type AuthenticatedUser,
  type ChangePasswordInput,
  type LoginInput,
  type RegisterInput,
  type UpdateProfileInput,
} from "./auth.types";
import { comparePassword, hashPassword } from "./password";
import { createSession, revokeAllSessions, revokeOtherSessions } from "./session.service";

export const DELETED_ACCOUNT_NAME = "Deleted Account";

export function deletedAccountEmail(userId: string): string {
  return `account-deleted-${userId}@deleted.invalid`;
}

async function buildAuthResponse(userId: string): Promise<AuthResponse> {
  const user = await prismaAdmin.user.findUniqueOrThrow({
    where: { id: userId },
    select: safeUserSelect,
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
      select: safeUserSelect,
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
      ...safeUserSelect,
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
  const user = await withUserContext(userId, (tx) =>
    tx.user.update({
      where: { id: userId },
      data: { name: input.name },
      select: safeUserSelect,
    }),
  );

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
      select: { passwordHash: true },
    }),
  );

  if (!user?.passwordHash) {
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

  await withUserContext(userId, (tx) =>
    tx.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: { id: true },
    }),
  );

  await revokeOtherSessions(userId, sessionId);
}

export async function deleteUserAccount(userId: string): Promise<void> {
  const user = await prismaAdmin.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, authProvider: true },
  });

  if (!user || user.authProvider === "deleted") {
    throw new ApiError(404, "USER_NOT_FOUND", "User not found");
  }

  const previousEmail = user.email;

  await prismaAdmin.$transaction(async (tx) => {
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

    await tx.groupMember.deleteMany({
      where: { userId },
    });

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
  });

  await revokeAllSessions(userId);

  await prismaAdmin.emailVerification.deleteMany({
    where: { email: previousEmail },
  });
}
