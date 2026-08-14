import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, handleApiError } from "@/lib/api-auth";
import { applyStockMovement } from "@/lib/stock";

const schema = z.object({
  productId: z.string(),
  quantity: z.number().positive(),
  referenceNumber: z.string().trim().max(60).optional(),
  reason: z.string().trim().max(200).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser("stock.receive");
    const body = schema.parse(await req.json());

    const result = await prisma.$transaction(async (tx) => {
      const r = await applyStockMovement(tx, {
        businessId: user.businessId,
        productId: body.productId,
        type: "RECEIVED",
        quantity: body.quantity,
        referenceNumber: body.referenceNumber,
        reason: body.reason || "Stock received",
        userId: user.id,
        allowNegative: true,
      });
      await tx.auditLog.create({
        data: {
          businessId: user.businessId,
          userId: user.id,
          action: "STOCK_RECEIVED",
          entityType: "Product",
          entityId: body.productId,
          details: { quantity: body.quantity, reason: body.reason },
        },
      });
      return r;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
