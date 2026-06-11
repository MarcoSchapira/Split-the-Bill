import type { Prisma } from "../generated/prisma/client";
import { prisma } from "./prisma";

export type PrismaTransaction = Prisma.TransactionClient;

export async function withUserContext<T>(
  userId: string,
  fn: (tx: PrismaTransaction) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
    return fn(tx);
  });
}

export async function withAdminContext<T>(
  fn: (tx: PrismaTransaction) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'true', true)`;
    return fn(tx);
  });
}
