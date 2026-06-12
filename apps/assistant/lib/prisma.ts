import { PrismaClient } from "@prisma/client";

/**
 * Lazy singleton. The client is only created on first use, so the app can run
 * with the in-memory repo (no DATABASE_URL) without ever opening a connection.
 * The globalThis cache prevents duplicate clients during Next.js hot reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({ log: ["error"] });
  }
  return globalForPrisma.prisma;
}
