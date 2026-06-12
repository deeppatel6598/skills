import { Repo } from "@/lib/types";
import { MemoryRepo } from "./memory";
import { PrismaRepo } from "./prisma";

let cached: Repo | null = null;

/**
 * Returns the active repository: Prisma/Postgres when DATABASE_URL is set,
 * otherwise the in-memory seed (so the demo runs anywhere with zero setup).
 * PrismaRepo is imported statically but only instantiated here, so no DB
 * connection is opened in memory mode.
 */
export function getRepo(): Repo {
  if (cached) return cached;
  cached = process.env.DATABASE_URL ? new PrismaRepo() : new MemoryRepo();
  return cached;
}

export const usingDatabase = () => Boolean(process.env.DATABASE_URL);
