import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, handleApiError } from "@/lib/api-auth";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser("stock.movements.view");
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    const limit = Math.min(Number(searchParams.get("limit") ?? 100), 300);

    const where: Prisma.StockMovementWhereInput = { businessId: user.businessId };
    if (productId) where.productId = productId;

    const movements = await prisma.stockMovement.findMany({
      where,
      include: { product: { select: { name: true, sku: true, unit: true } }, user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(movements);
  } catch (err) {
    return handleApiError(err);
  }
}
