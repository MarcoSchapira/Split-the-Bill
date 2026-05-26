import { Prisma } from "../generated/prisma/client";
import { prisma } from "../db/prisma";
import { ApiError } from "../http/errors";
import { signJwt } from "./jwt";
import { comparePassword, hashPassword } from "./password";
import {
  safeUserSelect,
  type AuthResponse,
  type LoginInput,
  type RegisterInput,
} from "./auth.types";

export async function registerUser(input: RegisterInput): Promise<AuthResponse> {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existingUser) {
    throw new ApiError(409, "EMAIL_ALREADY_REGISTERED", "Email is already registered");
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        authProvider: "local",
      },
      select: safeUserSelect,
    });

    return {
      token: signJwt({ userId: user.id }),
      user,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(409, "EMAIL_ALREADY_REGISTERED", "Email is already registered");
    }

    throw error;
  }
}

export async function loginUser(input: LoginInput): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({
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

  return {
    token: signJwt({ userId: user.id }),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
  };
}
