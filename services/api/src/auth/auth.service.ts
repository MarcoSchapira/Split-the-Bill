import { Prisma } from "../generated/prisma/client";
import { prismaAdmin } from "../db/prisma";
import { ApiError } from "../http/errors";
import { claimPendingInvitations } from "../invitations/invitation-claim";
import {
  safeUserSelect,
  type AuthResponse,
  type LoginInput,
  type RegisterInput,
} from "./auth.types";
import { comparePassword, hashPassword } from "./password";
import { createSession } from "./session.service";

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

  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prismaAdmin.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        authProvider: "local",
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

  return buildAuthResponse(user.id);
}
