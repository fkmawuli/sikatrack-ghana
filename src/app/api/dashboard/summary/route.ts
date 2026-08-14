import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, handleApiError } from "@/lib/api-auth";
import { getSalesSummary, getExpenditureSummary, startOfDayGhana, endOfDayGhana } from "@/lib/analytics";
import { toNumber, roundGHS, subtractGHS } from "@/lib/money";
import { GHANA_TZ } from "@/lib/datetime";
import { toZonedTime } from "date-fns-tz";

export async function GET() {
  try {
    const user = await requireUser("dashboard.view");
    const businessId = user.businessId;

    const settings = await prisma.businessSettings.findUnique({ where: { businessId } });
    const openingHour = settings?.openingHour ?? 8;
    const closingHour = settings?.closingHour ?? 20;

    const todayStart = startOfDayGhana(0);
    const todayEnd = endOfDayGhana(0);
    const yesterdayStart = startOfDayGhana(-1);
    const yesterdayEnd = endOfDayGhana(-1);

    const [todaySales, yesterdaySales, todayExpenditure] = await Promise.all([
      getSalesSummary(businessId, todayStart, todayEnd),
      getSalesSummary(businessId, yesterdayStart, yesterdayEnd),
      getExpenditureSummary(businessId, todayStart, todayEnd),
    ]);

    const estimatedNetProfit = roundGHS(subtractGHS(todaySales.grossProfit, todayExpenditure.operating));

    // Weekly trend: last 7 days revenue vs expenditure (oldest first)
    const weeklyTrend = await Promise.all(
      Array.from({ length: 7 }, (_, idx) => 6 - idx).map(async (i) => {
        const [s, e] = await Promise.all([
          getSalesSummary(businessId, startOfDayGhana(-i), endOfDayGhana(-i)),
          getExpenditureSummary(businessId, startOfDayGhana(-i), endOfDayGhana(-i)),
        ]);
        return {
          date: startOfDayGhana(-i).toISOString(),
          revenue: s.revenue,
          expenditure: e.operating,
          transactions: s.transactionCount,
        };
      })
    );

    // Best/slow selling products over the last 7 days
    const weekStart = startOfDayGhana(-6);
    const recentItems = await prisma.saleItem.findMany({
      where: {
        sale: { businessId, status: { in: ["COMPLETED", "PARTIALLY_RETURNED"] }, createdAt: { gte: weekStart } },
      },
      select: { productId: true, productName: true, quantity: true, lineTotal: true },
    });
    const salesByProduct = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const item of recentItems) {
      const key = item.productId;
      const existing = salesByProduct.get(key) ?? { name: item.productName, qty: 0, revenue: 0 };
      existing.qty += toNumber(item.quantity);
      existing.revenue = roundGHS(existing.revenue + toNumber(item.lineTotal));
      salesByProduct.set(key, existing);
    }
    const rankedProducts = Array.from(salesByProduct.entries())
      .map(([productId, v]) => ({ productId, ...v }))
      .sort((a, b) => b.qty - a.qty);
    const bestSelling = rankedProducts.slice(0, 5);

    const allActiveProducts = await prisma.product.findMany({
      where: { businessId, active: true },
      select: { id: true, name: true, stockQty: true, reorderLevel: true },
    });
    const soldProductIds = new Set(salesByProduct.keys());
    const slowSelling = allActiveProducts
      .filter((p) => !soldProductIds.has(p.id))
      .slice(0, 5)
      .map((p) => ({ productId: p.id, name: p.name, qty: 0, revenue: 0 }));

    const lowStock = allActiveProducts.filter(
      (p) => toNumber(p.stockQty) > 0 && toNumber(p.stockQty) <= toNumber(p.reorderLevel)
    );
    const outOfStock = allActiveProducts.filter((p) => toNumber(p.stockQty) <= 0);

    const recentTransactions = await prisma.sale.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { cashier: { select: { name: true } }, payments: true },
    });

    // ---- Daily Revenue Outlook ----
    const nowGhana = toZonedTime(new Date(), GHANA_TZ);
    const currentHourDecimal = nowGhana.getHours() + nowGhana.getMinutes() / 60;
    const totalTradingHours = Math.max(closingHour - openingHour, 1);
    const elapsedHours = Math.min(Math.max(currentHourDecimal - openingHour, 0), totalTradingHours);

    const MIN_ELAPSED_HOURS = 1;
    const MIN_TRANSACTIONS = 3;
    const hasEnoughData = elapsedHours >= MIN_ELAPSED_HOURS && todaySales.transactionCount >= MIN_TRANSACTIONS;

    const projectedClosingRevenue = hasEnoughData
      ? roundGHS((todaySales.revenue / elapsedHours) * totalTradingHours)
      : null;

    let vsYesterdayPercent: number | null = null;
    if (projectedClosingRevenue !== null && yesterdaySales.revenue > 0) {
      vsYesterdayPercent = roundGHS(
        ((projectedClosingRevenue - yesterdaySales.revenue) / yesterdaySales.revenue) * 100
      );
    }

    // Same-weekday historical average (last up to 8 occurrences, excluding today)
    const historicalResults = await Promise.all(
      Array.from({ length: 8 }, (_, idx) => idx + 1).map((weeksBack) => {
        const offset = -(weeksBack * 7);
        return getSalesSummary(businessId, startOfDayGhana(offset), endOfDayGhana(offset));
      })
    );
    const historicalSamples = historicalResults.filter((s) => s.transactionCount > 0).map((s) => s.revenue);
    let vsWeekdayAveragePercent: number | null = null;
    const weekdayAverageSampleSize = historicalSamples.length;
    if (projectedClosingRevenue !== null && historicalSamples.length >= 3) {
      const avg = historicalSamples.reduce((a, b) => a + b, 0) / historicalSamples.length;
      if (avg > 0) {
        vsWeekdayAveragePercent = roundGHS(((projectedClosingRevenue - avg) / avg) * 100);
      }
    }

    const outlook = {
      revenueSoFar: todaySales.revenue,
      elapsedHours: roundGHS(elapsedHours),
      totalTradingHours,
      projectedClosingRevenue,
      insufficientData: !hasEnoughData,
      vsYesterdayPercent,
      vsWeekdayAveragePercent,
      weekdayAverageSampleSize,
    };

    const revenueVsYesterdayPercent =
      yesterdaySales.revenue > 0
        ? roundGHS(((todaySales.revenue - yesterdaySales.revenue) / yesterdaySales.revenue) * 100)
        : null;

    return NextResponse.json({
      today: {
        revenue: todaySales.revenue,
        transactionCount: todaySales.transactionCount,
        expenditure: todayExpenditure.operating,
        personalWithdrawals: todayExpenditure.personalWithdrawals,
        cogs: todaySales.cogs,
        grossProfit: todaySales.grossProfit,
        estimatedNetProfit,
        averageTransactionValue: todaySales.averageTransactionValue,
        cashSales: todaySales.cashTotal,
        momoSales: todaySales.momoTotal,
        bankSales: todaySales.bankTotal,
        expectedCash: roundGHS(todaySales.cashTotal - todayExpenditure.cash),
        expectedMomo: roundGHS(todaySales.momoTotal - todayExpenditure.momo),
        expectedBank: roundGHS(todaySales.bankTotal - todayExpenditure.bank),
      },
      yesterday: { revenue: yesterdaySales.revenue },
      revenueVsYesterdayPercent,
      weeklyTrend,
      bestSelling,
      slowSelling,
      lowStock,
      outOfStock,
      recentTransactions,
      outlook,
      openingHour,
      closingHour,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
