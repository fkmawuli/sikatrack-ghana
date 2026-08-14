import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, handleApiError, ApiError } from "@/lib/api-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser("sales.view");
    const { id } = await params;
    const sale = await prisma.sale.findFirst({
      where: { id, businessId: user.businessId },
      include: {
        items: true,
        payments: true,
        cashier: { select: { name: true } },
        returns: { include: { items: true } },
      },
    });
    if (!sale) throw new ApiError(404, "Sale not found");
    return NextResponse.json(sale);
  } catch (err) {
    return handleApiError(err);
  }
}
