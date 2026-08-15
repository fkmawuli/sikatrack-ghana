import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireUser, handleApiError } from "@/lib/api-auth";
import { can } from "@/lib/rbac";
import { toNumber } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { Prisma } from "@prisma/client";

const CURRENCY_FMT = '"GH₵"#,##0.00';

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser("sales.view");
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const paymentMethod = searchParams.get("paymentMethod");
    const status = searchParams.get("status");

    const where: Prisma.SaleWhereInput = { businessId: user.businessId };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    if (status) where.status = status as Prisma.EnumSaleStatusFilter["equals"];
    if (paymentMethod) {
      where.payments = { some: { method: paymentMethod as "CASH" | "MOMO" | "BANK_TRANSFER" } };
    }

    const sales = await prisma.sale.findMany({
      where,
      include: { items: true, payments: true, cashier: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    const canSeeCost = can(user.role, "products.manage") || can(user.role, "reports.financial");

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "KudiTrack";
    workbook.created = new Date();

    // ---- Sales sheet (one row per transaction) ----
    const salesSheet = workbook.addWorksheet("Sales");
    salesSheet.columns = [
      { header: "Receipt Number", key: "receiptNumber", width: 20 },
      { header: "Date", key: "date", width: 12 },
      { header: "Time", key: "time", width: 10 },
      { header: "Cashier", key: "cashier", width: 18 },
      { header: "Customer Name", key: "customerName", width: 18 },
      { header: "Customer Phone", key: "customerPhone", width: 16 },
      { header: "Items", key: "itemCount", width: 8 },
      { header: "Payment Method(s)", key: "methods", width: 20 },
      { header: "Subtotal", key: "subtotal", width: 14 },
      { header: "Discount", key: "discount", width: 12 },
      { header: "Total", key: "total", width: 14 },
      { header: "Amount Received", key: "amountReceived", width: 16 },
      { header: "Change Given", key: "change", width: 14 },
      { header: "Status", key: "status", width: 18 },
      { header: "Note", key: "note", width: 24 },
    ];
    salesSheet.getRow(1).font = { bold: true };
    salesSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B5D33" } };
    salesSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    salesSheet.autoFilter = { from: "A1", to: "O1" };

    for (const sale of sales) {
      const row = salesSheet.addRow({
        receiptNumber: sale.receiptNumber,
        date: formatDate(sale.createdAt),
        time: formatDateTime(sale.createdAt).split(", ")[1],
        cashier: sale.cashier.name,
        customerName: sale.customerName || "",
        customerPhone: sale.customerPhone || "",
        itemCount: sale.items.length,
        methods: sale.payments.map((p) => p.method.replace("_", " ")).join(" + "),
        subtotal: toNumber(sale.subtotal),
        discount: toNumber(sale.discountAmount),
        total: toNumber(sale.totalAmount),
        amountReceived: toNumber(sale.amountReceived),
        change: toNumber(sale.changeGiven),
        status: sale.status.replace("_", " "),
        note: sale.note || "",
      });
      ["subtotal", "discount", "total", "amountReceived", "change"].forEach((key) => {
        row.getCell(key).numFmt = CURRENCY_FMT;
      });
    }

    // ---- Sale items sheet (one row per line item) ----
    const itemsSheet = workbook.addWorksheet("Sale Items");
    const itemColumns = [
      { header: "Receipt Number", key: "receiptNumber", width: 20 },
      { header: "Date", key: "date", width: 12 },
      { header: "Product", key: "product", width: 28 },
      { header: "Quantity", key: "quantity", width: 10 },
      { header: "Unit Price", key: "unitPrice", width: 12 },
      { header: "Line Total", key: "lineTotal", width: 14 },
    ];
    if (canSeeCost) {
      itemColumns.push(
        { header: "Cost Price", key: "costPrice", width: 12 },
        { header: "Line Profit", key: "lineProfit", width: 14 }
      );
    }
    itemsSheet.columns = itemColumns;
    itemsSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B5D33" } };
    itemsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    itemsSheet.autoFilter = { from: "A1", to: canSeeCost ? "H1" : "F1" };

    for (const sale of sales) {
      for (const item of sale.items) {
        const qty = toNumber(item.quantity);
        const unitPrice = toNumber(item.unitPrice);
        const lineTotal = toNumber(item.lineTotal);
        const rowData: Record<string, string | number> = {
          receiptNumber: sale.receiptNumber,
          date: formatDate(sale.createdAt),
          product: item.productName,
          quantity: qty,
          unitPrice,
          lineTotal,
        };
        if (canSeeCost) {
          const costPrice = toNumber(item.costPriceAtSale);
          rowData.costPrice = costPrice;
          rowData.lineProfit = Math.round((lineTotal - costPrice * qty) * 100) / 100;
        }
        const row = itemsSheet.addRow(rowData);
        ["unitPrice", "lineTotal", "costPrice", "lineProfit"].forEach((key) => {
          const cell = row.getCell(key);
          if (cell.value !== undefined && cell.value !== null) cell.numFmt = CURRENCY_FMT;
        });
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const dateStamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="kuditrack-sales-${dateStamp}.xlsx"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
