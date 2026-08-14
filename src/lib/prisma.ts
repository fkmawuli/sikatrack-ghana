import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    // Default 5s interactive-transaction timeout is too tight for a multi-item
    // sale (each line item does a few round trips) over a remote pooled
    // connection like Supabase's transaction pooler, where latency is higher
    // and more variable than a local database.
    transactionOptions: {
      maxWait: 10000,
      timeout: 20000,
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
