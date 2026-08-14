import type { Prisma, StockMovementType } from "@prisma/client";
import { ApiError } from "@/lib/api-auth";

/**
 * Applies a signed quantity delta to a product's stock inside a transaction,
 * recording a StockMovement row. `quantity` is signed: positive increases stock
 * (RECEIVED, RETURN, positive ADJUSTMENT/CORRECTION/OPENING), negative decreases it
 * (SALE, DAMAGED, EXPIRED, MISSING, negative ADJUSTMENT/CORRECTION).
 */
export async function applyStockMovement(
  tx: Prisma.TransactionClient,
  params: {
    businessId: string;
    productId: string;
    type: StockMovementType;
    quantity: number;
    referenceNumber?: string;
    reason?: string;
    userId: string;
    allowNegative?: boolean;
  }
) {
  const product = await tx.product.findFirst({
    where: { id: params.productId, businessId: params.businessId },
  });
  if (!product) throw new ApiError(404, "Product not found");

  const previousBalance = Number(product.stockQty);
  const newBalance = previousBalance + params.quantity;

  if (newBalance < 0 && !params.allowNegative) {
    throw new ApiError(
      400,
      `Insufficient stock for ${product.name}. Available: ${previousBalance}, requested: ${-params.quantity}`
    );
  }

  await tx.product.update({
    where: { id: product.id },
    data: { stockQty: newBalance },
  });

  await tx.stockMovement.create({
    data: {
      businessId: params.businessId,
      productId: product.id,
      type: params.type,
      quantity: params.quantity,
      previousBalance,
      newBalance,
      referenceNumber: params.referenceNumber,
      reason: params.reason,
      userId: params.userId,
    },
  });

  return { previousBalance, newBalance, product };
}
