import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, handleApiError } from "@/lib/api-auth";

export async function GET() {
  try {
    const user = await requireUser("products.view");
    const categories = await prisma.category.findMany({
      where: { businessId: user.businessId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(categories);
  } catch (err) {
    return handleApiError(err);
  }
}

const createSchema = z.object({ name: z.string().trim().min(1).max(60) });

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser("products.manage");
    const body = createSchema.parse(await req.json());
    const category = await prisma.category.upsert({
      where: { businessId_name: { businessId: user.businessId, name: body.name } },
      update: {},
      create: { businessId: user.businessId, name: body.name },
    });
    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
