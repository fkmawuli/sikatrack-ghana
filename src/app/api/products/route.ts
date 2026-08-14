import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, handleApiError } from "@/lib/api-auth";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser("products.view");
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const categoryId = searchParams.get("categoryId");
    const status = searchParams.get("status"); // active | inactive | low | out
    const limit = Math.min(Number(searchParams.get("limit") ?? 200), 500);

    const where: Prisma.ProductWhereInput = { businessId: user.businessId };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q, mode: "insensitive" } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (status === "active") where.active = true;
    if (status === "inactive") where.active = false;

    let products = await prisma.product.findMany({
      where,
      include: { category: true, supplier: true },
      orderBy: { name: "asc" },
      take: limit,
    });

    if (status === "low") {
      products = products.filter(
        (p) => Number(p.stockQty) > 0 && Number(p.stockQty) <= Number(p.reorderLevel)
      );
    }
    if (status === "out") {
      products = products.filter((p) => Number(p.stockQty) <= 0);
    }

    return NextResponse.json(products);
  } catch (err) {
    return handleApiError(err);
  }
}

const createSchema = z.object({
  sku: z.string().trim().min(1).max(50),
  barcode: z.string().trim().max(50).optional().nullable(),
  name: z.string().trim().min(1).max(150),
  categoryId: z.string().optional().nullable(),
  unit: z.string().trim().min(1).max(20).default("piece"),
  costPrice: z.number().nonnegative(),
  sellingPrice: z.number().nonnegative(),
  openingStock: z.number().nonnegative().default(0),
  reorderLevel: z.number().nonnegative().default(5),
  supplierId: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser("products.manage");
    const body = createSchema.parse(await req.json());

    const existing = await prisma.product.findUnique({
      where: { businessId_sku: { businessId: user.businessId, sku: body.sku } },
    });
    if (existing) {
      return NextResponse.json({ error: "A product with this SKU already exists" }, { status: 409 });
    }

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          businessId: user.businessId,
          sku: body.sku,
          barcode: body.barcode || null,
          name: body.name,
          categoryId: body.categoryId || null,
          unit: body.unit,
          costPrice: body.costPrice,
          sellingPrice: body.sellingPrice,
          stockQty: body.openingStock,
          reorderLevel: body.reorderLevel,
          supplierId: body.supplierId || null,
          imageUrl: body.imageUrl || null,
        },
      });

      if (body.openingStock > 0) {
        await tx.stockMovement.create({
          data: {
            businessId: user.businessId,
            productId: created.id,
            type: "OPENING",
            quantity: body.openingStock,
            previousBalance: 0,
            newBalance: body.openingStock,
            reason: "Opening stock at product creation",
            userId: user.id,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          businessId: user.businessId,
          userId: user.id,
          action: "PRODUCT_CREATED",
          entityType: "Product",
          entityId: created.id,
          details: { name: created.name, sku: created.sku },
        },
      });

      return created;
    });

    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
