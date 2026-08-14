import { formatInTimeZone } from "date-fns-tz";
import { GHANA_TZ } from "@/lib/datetime";
import type { Prisma } from "@prisma/client";

/**
 * Generates a human-readable, unique-per-business receipt number, e.g. RCT-20260813-0007.
 * Sequence is based on how many sales already exist for the business today (Ghana time).
 * Must be called inside the same transaction that creates the Sale, so the count is
 * consistent with the insert (the unique DB constraint on receiptNumber is the final guard).
 */
export async function generateReceiptNumber(
  tx: Prisma.TransactionClient,
  businessId: string
): Promise<string> {
  const dateStr = formatInTimeZone(new Date(), GHANA_TZ, "yyyyMMdd");
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const count = await tx.sale.count({
    where: {
      businessId,
      receiptNumber: { startsWith: `RCT-${dateStr}-` },
    },
  });

  return `RCT-${dateStr}-${String(count + 1).padStart(4, "0")}`;
}
