import { prisma } from "@/lib/prisma";
import { toNumber, roundGHS, addGHS, subtractGHS } from "@/lib/money";
import { GHANA_TZ } from "@/lib/datetime";
import { toZonedTime } from "date-fns-tz";

export function startOfDayGhana(offsetDays = 0): Date {
  const zoned = toZonedTime(new Date(), GHANA_TZ);
  zoned.setDate(zoned.getDate() + offsetDays);
  zoned.setHours(0, 0, 0, 0);
  return zoned;
}

export function endOfDayGhana(offsetDays = 0): Date {
  const start = startOfDayGhana(offsetDays);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return end;
}

/** Revenue + COGS + transaction count for completed sales in [from, to]. Cancelled sales are excluded. */
export async function getSalesSummary(businessId: string, from: Date, to: Date) {
  const sales = await prisma.sale.findMany({
    where: {
      businessId,
      status: { in: ["COMPLETED", "PARTIALLY_RETURNED", "FULLY_RETURNED"] },
      createdAt: { gte: from, lte: to },
    },
    include: { items: true, payments: true },
  });

  // Fully-returned sales contribute no net revenue; partially-returned sales are
  // reduced by the returned portion so returns are never counted as revenue.
  let revenue = 0;
  let cogs = 0;
  let cashTotal = 0;
  let momoTotal = 0;
  let bankTotal = 0;
  let transactionCount = 0;

  for (const sale of sales) {
    if (sale.status === "FULLY_RETURNED") continue;
    transactionCount += 1;

    const returnedRatioTotal = sale.items.reduce((sum, item) => {
      const qty = toNumber(item.quantity);
      const returned = toNumber(item.returnedQuantity);
      const lineTotal = toNumber(item.lineTotal);
      const netLine = qty > 0 ? roundGHS((lineTotal * (qty - returned)) / qty) : 0;
      cogs = addGHS(cogs, toNumber(item.costPriceAtSale) * (qty - returned));
      return addGHS(sum, netLine);
    }, 0);

    const discountRatio =
      toNumber(sale.subtotal) > 0 ? toNumber(sale.discountAmount) / toNumber(sale.subtotal) : 0;
    const netSaleRevenue = roundGHS(returnedRatioTotal * (1 - discountRatio));
    revenue = addGHS(revenue, netSaleRevenue);

    for (const payment of sale.payments) {
      const amt = toNumber(payment.amount);
      if (payment.method === "CASH") cashTotal = addGHS(cashTotal, amt);
      if (payment.method === "MOMO") momoTotal = addGHS(momoTotal, amt);
      if (payment.method === "BANK_TRANSFER") bankTotal = addGHS(bankTotal, amt);
    }
  }

  return {
    revenue: roundGHS(revenue),
    cogs: roundGHS(cogs),
    grossProfit: roundGHS(subtractGHS(revenue, cogs)),
    transactionCount,
    averageTransactionValue: transactionCount > 0 ? roundGHS(revenue / transactionCount) : 0,
    cashTotal: roundGHS(cashTotal),
    momoTotal: roundGHS(momoTotal),
    bankTotal: roundGHS(bankTotal),
  };
}

export async function getExpenditureSummary(businessId: string, from: Date, to: Date) {
  const expenses = await prisma.expense.findMany({
    where: { businessId, expenseDate: { gte: from, lte: to } },
  });

  let operating = 0;
  let personalWithdrawals = 0;
  let cash = 0;
  let momo = 0;
  let bank = 0;

  for (const e of expenses) {
    const amt = toNumber(e.amount);
    if (e.isPersonalWithdrawal) {
      personalWithdrawals = addGHS(personalWithdrawals, amt);
    } else {
      operating = addGHS(operating, amt);
    }
    if (e.paymentMethod === "CASH") cash = addGHS(cash, amt);
    if (e.paymentMethod === "MOMO") momo = addGHS(momo, amt);
    if (e.paymentMethod === "BANK_TRANSFER") bank = addGHS(bank, amt);
  }

  return {
    operating: roundGHS(operating),
    personalWithdrawals: roundGHS(personalWithdrawals),
    total: roundGHS(addGHS(operating, personalWithdrawals)),
    cash: roundGHS(cash),
    momo: roundGHS(momo),
    bank: roundGHS(bank),
  };
}
