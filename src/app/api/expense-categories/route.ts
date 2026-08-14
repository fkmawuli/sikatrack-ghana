import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, handleApiError } from "@/lib/api-auth";

export async function GET() {
  try {
    const user = await requireUser("expenditure.view");
    const categories = await prisma.expenseCategory.findMany({
      where: { businessId: user.businessId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(categories);
  } catch (err) {
    return handleApiError(err);
  }
}

const schema = z.object({ name: z.string().trim().min(1).max(60) });

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser("settings.manage");
    const body = schema.parse(await req.json());
    const category = await prisma.expenseCategory.upsert({
      where: { businessId_name: { businessId: user.businessId, name: body.name } },
      update: {},
      create: { businessId: user.businessId, name: body.name },
    });
    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
