import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, handleApiError, ApiError } from "@/lib/api-auth";
import { applyStockMovement } from "@/lib/stock";
import { generateReceiptNumber } from "@/lib/receipt-number";
import { addGHS, subtractGHS, roundGHS } from "@/lib/money";
import { can } from "@/lib/rbac";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser("sales.view");
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const paymentMethod = searchParams.get("paymentMethod");
    const cashierId = searchParams.get("cashierId");
    const status = searchParams.get("status");
    const limit = Math.min(Number(searchParams.get("limit") ?? 100), 500);

    const where: Prisma.SaleWhereInput = { businessId: user.businessId };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    if (cashierId) where.cashierId = cashierId;
    if (status) where.status = status as Prisma.EnumSaleStatusFilter["equals"];
    if (paymentMethod) {
      where.payments = { some: { method: paymentMethod as "CASH" | "MOMO" | "BANK_TRANSFER" } };
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        items: true,
        payments: true,
        cashier: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(sales);
  } catch (err) {
    return handleApiError(err);
  }
}

const saleItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().positive(),
});

const paymentSchema = z.object({
  method: z.enum(["CASH", "MOMO", "BANK_TRANSFER"]),
  amount: z.number().positive(),
});

const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, "Add at least one product"),
  discountAmount: z.number().min(0).default(0),
  discountReason: z.string().trim().max(200).optional(),
  payments: z.array(paymentSchema).min(1, "Select a payment method"),
  customerName: z.string().trim().max(100).optional(),
  customerPhone: z.string().trim().max(20).optional(),
  note: z.string().trim().max(300).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser("sales.create");
    const body = createSaleSchema.parse(await req.json());

    if (body.discountAmount > 0 && !can(user.role, "discounts.approve")) {
      throw new ApiError(403, "Only an owner or manager can apply a discount");
    }

    const settings = await prisma.businessSettings.findUnique({
      where: { businessId: user.businessId },
    });
    const negativeStockAllowed = settings?.negativeStockAllowed ?? false;

    const productIds = body.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, businessId: user.businessId },
    });
    if (products.length !== new Set(productIds).size) {
      throw new ApiError(400, "One or more products were not found");
    }
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of body.items) {
      const product = productMap.get(item.productId)!;
      if (!product.active) throw new ApiError(400, `${product.name} is not available for sale`);
      if (!negativeStockAllowed && Number(product.stockQty) < item.quantity) {
        throw new ApiError(
          400,
          `Insufficient stock for ${product.name}. Available: ${Number(product.stockQty)}, requested: ${item.quantity}`
        );
      }
    }

    const subtotal = roundGHS(
      addGHS(
        ...body.items.map((item) => {
          const product = productMap.get(item.productId)!;
          return Number(product.sellingPrice) * item.quantity;
        })
      )
    );

    if (body.discountAmount > subtotal) {
      throw new ApiError(400, "Discount cannot exceed the subtotal");
    }
    const totalAmount = roundGHS(subtractGHS(subtotal, body.discountAmount));

    const amountReceived = roundGHS(addGHS(...body.payments.map((p) => p.amount)));
    if (amountReceived < totalAmount - 0.005) {
      throw new ApiError(400, "Payment amount is less than the total due");
    }
    const changeGiven = roundGHS(subtractGHS(amountReceived, totalAmount));

    const sale = await prisma.$transaction(async (tx) => {
      const receiptNumber = await generateReceiptNumber(tx, user.businessId);

      const created = await tx.sale.create({
        data: {
          businessId: user.businessId,
          receiptNumber,
          cashierId: user.id,
          customerName: body.customerName || null,
          customerPhone: body.customerPhone || null,
          note: body.note || null,
          subtotal,
          discountAmount: body.discountAmount,
          discountReason: body.discountReason || null,
          totalAmount,
          amountReceived,
          changeGiven,
          status: "COMPLETED",
          items: {
            create: body.items.map((item) => {
              const product = productMap.get(item.productId)!;
              return {
                productId: product.id,
                productName: product.name,
                quantity: item.quantity,
                unitPrice: product.sellingPrice,
                costPriceAtSale: product.costPrice,
                lineTotal: roundGHS(Number(product.sellingPrice) * item.quantity),
              };
            }),
          },
          payments: {
            create: body.payments.map((p) => ({ method: p.method, amount: p.amount })),
          },
        },
        include: { items: true, payments: true },
      });

      for (const item of body.items) {
        await applyStockMovement(tx, {
          businessId: user.businessId,
          productId: item.productId,
          type: "SALE",
          quantity: -item.quantity,
          referenceNumber: receiptNumber,
          reason: "Sale",
          userId: user.id,
          allowNegative: negativeStockAllowed,
        });
      }

      await tx.auditLog.create({
        data: {
          businessId: user.businessId,
          userId: user.id,
          action: "SALE_COMPLETED",
          entityType: "Sale",
          entityId: created.id,
          details: { receiptNumber, totalAmount, itemCount: body.items.length },
        },
      });

      return created;
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
