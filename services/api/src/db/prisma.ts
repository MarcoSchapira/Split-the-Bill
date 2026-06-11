import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createAdminAdapter } from "./verifyDbRoles";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaAdmin: PrismaClient | undefined;
};

function createPrismaClient(connectionString: string | undefined) {
  const adapter = new PrismaPg({
    connectionString: connectionString ?? process.env.DATABASE_URL,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient(process.env.DATABASE_URL);

export const prismaAdmin =
  globalForPrisma.prismaAdmin ?? new PrismaClient({ adapter: createAdminAdapter() });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaAdmin = prismaAdmin;
}

export async function disconnectPrisma(): Promise<void> {
  await Promise.all([prisma.$disconnect(), prismaAdmin.$disconnect()]);
}
