import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, handleApiError, ApiError } from "@/lib/api-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser("products.view");
    const { id } = await params;
    const product = await prisma.product.findFirst({
      where: { id, businessId: user.businessId },
      include: { category: true, supplier: true },
    });
    if (!product) throw new ApiError(404, "Product not found");
    return NextResponse.json(product);
  } catch (err) {
    return handleApiError(err);
  }
}

const updateSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  barcode: z.string().trim().max(50).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  unit: z.string().trim().min(1).max(20).optional(),
  costPrice: z.number().nonnegative().optional(),
  sellingPrice: z.number().nonnegative().optional(),
  reorderLevel: z.number().nonnegative().optional(),
  supplierId: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser("products.manage");
    const { id } = await params;
    const body = updateSchema.parse(await req.json());

    const existing = await prisma.product.findFirst({ where: { id, businessId: user.businessId } });
    if (!existing) throw new ApiError(404, "Product not found");

    const updated = await prisma.product.update({ where: { id }, data: body });

    await prisma.auditLog.create({
      data: {
        businessId: user.businessId,
        userId: user.id,
        action: "PRODUCT_UPDATED",
        entityType: "Product",
        entityId: id,
        details: body,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
