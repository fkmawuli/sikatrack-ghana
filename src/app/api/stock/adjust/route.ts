import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, handleApiError } from "@/lib/api-auth";
import { applyStockMovement } from "@/lib/stock";

const LOSS_TYPES = ["DAMAGED", "EXPIRED", "MISSING"] as const;
const SIGNED_TYPES = ["ADJUSTMENT", "CORRECTION"] as const;

const schema = z.object({
  productId: z.string(),
  type: z.enum([...LOSS_TYPES, ...SIGNED_TYPES]),
  quantity: z.number().refine((v) => v !== 0, "Quantity cannot be zero"),
  reason: z.string().trim().min(3, "A reason is required").max(200),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser("stock.adjust");
    const body = schema.parse(await req.json());

    // Loss types are always entered as a positive magnitude and applied as a decrease.
    const signedQuantity = (LOSS_TYPES as readonly string[]).includes(body.type)
      ? -Math.abs(body.quantity)
      : body.quantity;

    const result = await prisma.$transaction(async (tx) => {
      const r = await applyStockMovement(tx, {
        businessId: user.businessId,
        productId: body.productId,
        type: body.type,
        quantity: signedQuantity,
        reason: body.reason,
        userId: user.id,
        allowNegative: body.type === "CORRECTION",
      });
      await tx.auditLog.create({
        data: {
          businessId: user.businessId,
          userId: user.id,
          action: `STOCK_${body.type}`,
          entityType: "Product",
          entityId: body.productId,
          details: { quantity: signedQuantity, reason: body.reason },
        },
      });
      return r;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
