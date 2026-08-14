import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, handleApiError } from "@/lib/api-auth";

export async function GET() {
  try {
    const user = await requireUser();
    const business = await prisma.business.findUnique({
      where: { id: user.businessId },
      include: { settings: true },
    });
    return NextResponse.json(business);
  } catch (err) {
    return handleApiError(err);
  }
}

const schema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  phone: z.string().trim().max(30).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  email: z.string().trim().max(150).optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  taxId: z.string().trim().max(60).optional().nullable(),
  settings: z
    .object({
      openingHour: z.number().min(0).max(23).optional(),
      closingHour: z.number().min(0).max(23).optional(),
      negativeStockAllowed: z.boolean().optional(),
      lowStockAlertEnabled: z.boolean().optional(),
      defaultReceiptSize: z.enum(["58mm", "80mm", "A4"]).optional(),
      showReprintLabel: z.boolean().optional(),
      receiptFooterMessage: z.string().trim().max(300).optional().nullable(),
      returnPolicy: z.string().trim().max(500).optional().nullable(),
      taxEnabled: z.boolean().optional(),
      taxRate: z.number().min(0).max(100).optional(),
    })
    .optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser("settings.manage");
    const body = schema.parse(await req.json());
    const { settings, ...businessFields } = body;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.business.update({
        where: { id: user.businessId },
        data: businessFields,
      });
      if (settings) {
        await tx.businessSettings.update({
          where: { businessId: user.businessId },
          data: settings,
        });
      }
      await tx.auditLog.create({
        data: {
          businessId: user.businessId,
          userId: user.id,
          action: "SETTINGS_UPDATED",
          entityType: "Business",
          entityId: user.businessId,
          details: body,
        },
      });
      return tx.business.findUnique({ where: { id: user.businessId }, include: { settings: true } });
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
