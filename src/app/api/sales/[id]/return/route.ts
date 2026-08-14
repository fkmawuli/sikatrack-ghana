import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, handleApiError, ApiError } from "@/lib/api-auth";
import { applyStockMovement } from "@/lib/stock";
import { roundGHS } from "@/lib/money";

const schema = z.object({
  type: z.enum(["PARTIAL_RETURN", "FULL_RETURN", "EXCHANGE"]),
  reason: z.string().trim().min(3, "A reason is required").max(300),
  items: z
    .array(z.object({ saleItemId: z.string(), quantity: z.number().positive(), restock: z.boolean().default(true) }))
    .min(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser("sales.return.approve");
    const { id } = await params;
    const body = schema.parse(await req.json());

    const sale = await prisma.sale.findFirst({
      where: { id, businessId: user.businessId },
      include: { items: true },
    });
    if (!sale) throw new ApiError(404, "Sale not found");
    if (sale.status === "CANCELLED" || sale.status === "FULLY_RETURNED") {
      throw new ApiError(400, "This sale cannot be returned against");
    }

    const saleItemMap = new Map(sale.items.map((i) => [i.id, i]));
    let refundAmount = 0;
    for (const returnItem of body.items) {
      const saleItem = saleItemMap.get(returnItem.saleItemId);
      if (!saleItem) throw new ApiError(400, "Sale item not found on this sale");
      const remaining = Number(saleItem.quantity) - Number(saleItem.returnedQuantity);
      if (returnItem.quantity > remaining) {
        throw new ApiError(400, `Cannot return more than ${remaining} of ${saleItem.productName}`);
      }
      refundAmount = roundGHS(refundAmount + returnItem.quantity * Number(saleItem.unitPrice));
    }

    await prisma.$transaction(async (tx) => {
      await tx.return.create({
        data: {
          businessId: user.businessId,
          saleId: sale.id,
          type: body.type,
          reason: body.reason,
          refundAmount,
          requestedByUserId: user.id,
          approvedByUserId: user.id,
          items: {
            create: body.items.map((i) => ({
              saleItemId: i.saleItemId,
              quantity: i.quantity,
              restocked: i.restock,
            })),
          },
        },
      });

      for (const returnItem of body.items) {
        const saleItem = saleItemMap.get(returnItem.saleItemId)!;
        if (returnItem.restock) {
          await applyStockMovement(tx, {
            businessId: user.businessId,
            productId: saleItem.productId,
            type: "RETURN",
            quantity: returnItem.quantity,
            referenceNumber: sale.receiptNumber,
            reason: `Return: ${body.reason}`,
            userId: user.id,
            allowNegative: true,
          });
        }
        await tx.saleItem.update({
          where: { id: saleItem.id },
          data: { returnedQuantity: { increment: returnItem.quantity } },
        });
      }

      const refreshedItems = await tx.saleItem.findMany({ where: { saleId: sale.id } });
      const fullyReturned = refreshedItems.every(
        (i) => Number(i.returnedQuantity) >= Number(i.quantity)
      );
      const anyReturned = refreshedItems.some((i) => Number(i.returnedQuantity) > 0);

      await tx.sale.update({
        where: { id: sale.id },
        data: { status: fullyReturned ? "FULLY_RETURNED" : anyReturned ? "PARTIALLY_RETURNED" : "COMPLETED" },
      });

      await tx.auditLog.create({
        data: {
          businessId: user.businessId,
          userId: user.id,
          action: `SALE_${body.type}`,
          entityType: "Sale",
          entityId: sale.id,
          details: { reason: body.reason, refundAmount },
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
