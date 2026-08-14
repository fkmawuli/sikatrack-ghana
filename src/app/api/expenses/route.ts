import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, handleApiError } from "@/lib/api-auth";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser("expenditure.view");
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const categoryId = searchParams.get("categoryId");
    const limit = Math.min(Number(searchParams.get("limit") ?? 200), 500);

    const where: Prisma.ExpenseWhereInput = { businessId: user.businessId };
    if (from || to) {
      where.expenseDate = {};
      if (from) where.expenseDate.gte = new Date(from);
      if (to) where.expenseDate.lte = new Date(to);
    }
    if (categoryId) where.categoryId = categoryId;

    const expenses = await prisma.expense.findMany({
      where,
      include: { category: true, user: { select: { name: true } } },
      orderBy: { expenseDate: "desc" },
      take: limit,
    });

    return NextResponse.json(expenses);
  } catch (err) {
    return handleApiError(err);
  }
}

const schema = z.object({
  categoryId: z.string(),
  description: z.string().trim().min(1).max(300),
  amount: z.number().positive(),
  paymentMethod: z.enum(["CASH", "MOMO", "BANK_TRANSFER"]),
  payee: z.string().trim().max(100).optional(),
  referenceNumber: z.string().trim().max(60).optional(),
  receiptUrl: z.string().url().optional(),
  isPersonalWithdrawal: z.boolean().default(false),
  expenseDate: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser("expenditure.record");
    const body = schema.parse(await req.json());

    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          businessId: user.businessId,
          categoryId: body.categoryId,
          description: body.description,
          amount: body.amount,
          paymentMethod: body.paymentMethod,
          payee: body.payee || null,
          referenceNumber: body.referenceNumber || null,
          receiptUrl: body.receiptUrl || null,
          isPersonalWithdrawal: body.isPersonalWithdrawal,
          userId: user.id,
          expenseDate: new Date(body.expenseDate),
        },
        include: { category: true },
      });

      await tx.auditLog.create({
        data: {
          businessId: user.businessId,
          userId: user.id,
          action: "EXPENSE_RECORDED",
          entityType: "Expense",
          entityId: created.id,
          details: { amount: body.amount, category: created.category.name },
        },
      });

      return created;
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
