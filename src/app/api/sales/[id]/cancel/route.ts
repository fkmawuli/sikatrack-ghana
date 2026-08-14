import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, handleApiError, ApiError } from "@/lib/api-auth";
import { applyStockMovement } from "@/lib/stock";

const schema = z.object({ reason: z.string().trim().min(3, "A reason is required").max(300) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser("sales.cancel");
    const { id } = await params;
    const body = schema.parse(await req.json());

    const sale = await prisma.sale.findFirst({
      where: { id, businessId: user.businessId },
      include: { items: true },
    });
    if (!sale) throw new ApiError(404, "Sale not found");
    if (sale.status !== "COMPLETED") {
      throw new ApiError(400, "Only a completed sale can be cancelled");
    }

    await prisma.$transaction(async (tx) => {
      const ret = await tx.return.create({
        data: {
          businessId: user.businessId,
          saleId: sale.id,
          type: "CANCELLATION",
          reason: body.reason,
          refundAmount: sale.totalAmount,
          requestedByUserId: user.id,
          approvedByUserId: user.id,
          items: {
            create: sale.items.map((item) => ({
              saleItemId: item.id,
              quantity: Number(item.quantity) - Number(item.returnedQuantity),
              restocked: true,
            })),
          },
        },
      });

      for (const item of sale.items) {
        const qty = Number(item.quantity) - Number(item.returnedQuantity);
        if (qty <= 0) continue;
        await applyStockMovement(tx, {
          businessId: user.businessId,
          productId: item.productId,
          type: "RETURN",
          quantity: qty,
          referenceNumber: sale.receiptNumber,
          reason: `Sale cancelled: ${body.reason}`,
          userId: user.id,
          allowNegative: true,
        });
        await tx.saleItem.update({
          where: { id: item.id },
          data: { returnedQuantity: item.quantity },
        });
      }

      await tx.sale.update({ where: { id: sale.id }, data: { status: "CANCELLED" } });

      await tx.auditLog.create({
        data: {
          businessId: user.businessId,
          userId: user.id,
          action: "SALE_CANCELLED",
          entityType: "Sale",
          entityId: sale.id,
          details: { reason: body.reason, returnId: ret.id },
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
