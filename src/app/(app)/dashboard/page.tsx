"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { formatGHS } from "@/lib/money";
import { formatDate, formatTime } from "@/lib/datetime";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Wallet,
  Package,
  AlertTriangle,
  Info,
  DollarSign,
} from "lucide-react";

interface DashboardData {
  today: {
    revenue: number;
    transactionCount: number;
    expenditure: number;
    personalWithdrawals: number;
    cogs: number;
    grossProfit: number;
    estimatedNetProfit: number;
    averageTransactionValue: number;
    cashSales: number;
    momoSales: number;
    bankSales: number;
    expectedCash: number;
    expectedMomo: number;
    expectedBank: number;
  };
  yesterday: { revenue: number };
  revenueVsYesterdayPercent: number | null;
  weeklyTrend: { date: string; revenue: number; expenditure: number; transactions: number }[];
  bestSelling: { productId: string; name: string; qty: number; revenue: number }[];
  slowSelling: { productId: string; name: string; qty: number; revenue: number }[];
  lowStock: { id: string; name: string; stockQty: string; reorderLevel: string }[];
  outOfStock: { id: string; name: string }[];
  recentTransactions: {
    id: string;
    receiptNumber: string;
    totalAmount: string;
    createdAt: string;
    status: string;
    cashier: { name: string };
    payments: { method: string }[];
  }[];
  outlook: {
    revenueSoFar: number;
    elapsedHours: number;
    totalTradingHours: number;
    projectedClosingRevenue: number | null;
    insufficientData: boolean;
    vsYesterdayPercent: number | null;
    vsWeekdayAveragePercent: number | null;
    weekdayAverageSampleSize: number;
  };
  openingHour: number;
  closingHour: number;
}

const STATUS_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  COMPLETED: "success",
  CANCELLED: "danger",
  PARTIALLY_RETURNED: "warning",
  FULLY_RETURNED: "danger",
};

function TrendPill({ value }: { value: number | null }) {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 mt-2 text-xs font-semibold rounded-full px-2 py-0.5 ${
        up ? "bg-success-light text-success" : "bg-danger-light text-danger"
      }`}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {up ? "+" : ""}
      {value}%
    </span>
  );
}

function StatCard({
  label,
  value,
  icon,
  iconTone = "primary",
  trend,
  trendCaption,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconTone?: "primary" | "danger" | "success" | "gold";
  trend?: number | null;
  trendCaption?: string;
}) {
  const toneClasses: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    danger: "bg-danger-light text-danger",
    success: "bg-success-light text-success",
    gold: "bg-gold-light text-gold-dark",
  };
  return (
    <Card className="rounded-2xl">
      <CardBody>
        <div className="flex items-start justify-between">
          <p className="text-sm text-muted font-medium">{label}</p>
          <div className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center ${toneClasses[iconTone]}`}>
            {icon}
          </div>
        </div>
        <p className="text-2xl font-bold mt-2 text-foreground">{value}</p>
        {trend !== undefined && (
          <div className="flex items-center gap-2">
            <TrendPill value={trend} />
            {trendCaption && <span className="text-xs text-muted mt-2">{trendCaption}</span>}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

const PAYMENT_COLORS = { CASH: "var(--primary)", MOMO: "var(--gold)", BANK: "var(--primary-light)" };

export default function DashboardPage() {
  const toast = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<DashboardData>("/api/dashboard/summary");
      setData(d);
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : "Failed to load dashboard", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !data) {
    return <p className="text-center text-muted py-16">Loading dashboard…</p>;
  }

  const { today, outlook } = data;

  const paymentData = [
    { name: "Cash", value: today.cashSales, color: PAYMENT_COLORS.CASH },
    { name: "Mobile Money", value: today.momoSales, color: PAYMENT_COLORS.MOMO },
    { name: "Bank Transfer", value: today.bankSales, color: PAYMENT_COLORS.BANK },
  ].filter((p) => p.value > 0);
  const paymentTotal = today.cashSales + today.momoSales + today.bankSales;

  return (
    <div className="pb-6">
      <PageHeader title="Dashboard" subtitle={`Today, ${formatDate(new Date())}`} />

      {/* Primary metrics */}
      <div className="px-4 lg:px-6 grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <StatCard
          label="Today's revenue"
          value={formatGHS(today.revenue)}
          icon={<DollarSign className="h-4 w-4" />}
          iconTone="primary"
          trend={data.revenueVsYesterdayPercent}
          trendCaption="vs yesterday"
        />
        <StatCard label="Transactions" value={String(today.transactionCount)} icon={<Receipt className="h-4 w-4" />} iconTone="primary" />
        <StatCard label="Expenditure" value={formatGHS(today.expenditure)} icon={<Wallet className="h-4 w-4" />} iconTone="danger" />
        <StatCard label="Estimated net profit" value={formatGHS(today.estimatedNetProfit)} icon={<TrendingUp className="h-4 w-4" />} iconTone="gold" />
      </div>

      {/* Secondary metrics */}
      <div className="px-4 lg:px-6 grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Cost of goods sold" value={formatGHS(today.cogs)} icon={<Package className="h-4 w-4" />} iconTone="primary" />
        <StatCard label="Gross profit" value={formatGHS(today.grossProfit)} icon={<TrendingUp className="h-4 w-4" />} iconTone="success" />
        <StatCard label="Average sale value" value={formatGHS(today.averageTransactionValue)} icon={<Receipt className="h-4 w-4" />} iconTone="primary" />
        <StatCard
          label="Cash expected in till"
          value={formatGHS(today.expectedCash)}
          icon={<Wallet className="h-4 w-4" />}
          iconTone="gold"
        />
      </div>

      {/* Daily Revenue Outlook */}
      <div className="px-4 lg:px-6 mb-4">
        <Card className="rounded-2xl border-primary/30 bg-gradient-to-br from-primary to-primary-dark text-white">
          <CardBody>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Daily Revenue Outlook</h3>
              <Badge tone="gold">Estimate</Badge>
            </div>
            {outlook.insufficientData ? (
              <p className="text-sm text-white/80 flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                Not enough trading time or sales data yet today to project a closing revenue. Check back
                after a few more sales, or later in the trading day ({data.openingHour}:00–{data.closingHour}:00).
              </p>
            ) : (
              <>
                <p className="text-3xl font-bold">{formatGHS(outlook.projectedClosingRevenue ?? 0)}</p>
                <p className="text-xs text-white/70 mb-3">
                  Projected closing revenue by {data.closingHour}:00, based on {formatGHS(outlook.revenueSoFar)} earned
                  in {outlook.elapsedHours} of {outlook.totalTradingHours} trading hours so far.
                </p>
                <div className="flex flex-wrap gap-4 text-sm">
                  {outlook.vsYesterdayPercent !== null && (
                    <span>
                      Vs. yesterday:{" "}
                      <strong className={outlook.vsYesterdayPercent >= 0 ? "text-gold-light" : "text-red-300"}>
                        {outlook.vsYesterdayPercent > 0 ? "+" : ""}
                        {outlook.vsYesterdayPercent}%
                      </strong>
                    </span>
                  )}
                  {outlook.vsWeekdayAveragePercent !== null ? (
                    <span>
                      Vs. average for this day of week ({outlook.weekdayAverageSampleSize} weeks):{" "}
                      <strong className={outlook.vsWeekdayAveragePercent >= 0 ? "text-gold-light" : "text-red-300"}>
                        {outlook.vsWeekdayAveragePercent > 0 ? "+" : ""}
                        {outlook.vsWeekdayAveragePercent}%
                      </strong>
                    </span>
                  ) : (
                    <span className="text-white/70">Not enough weekly history yet for a day-of-week comparison.</span>
                  )}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Bento grid: transactions | revenue + best sellers | payment mix */}
      <div className="px-4 lg:px-6 grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
        <Card className="rounded-2xl lg:col-span-4 lg:order-1 order-3">
          <CardBody>
            <h3 className="font-semibold mb-3">Recent transactions</h3>
            <div className="space-y-1 max-h-[420px] overflow-y-auto">
              {data.recentTransactions.length === 0 && <p className="text-sm text-muted">No sales yet</p>}
              {data.recentTransactions.map((t) => (
                <Link
                  key={t.id}
                  href={`/sales/${t.id}`}
                  className="flex items-center gap-3 py-2 border-b border-border last:border-0 hover:bg-background rounded-lg px-1"
                >
                  <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                    {t.cashier.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.receiptNumber}</p>
                    <p className="text-xs text-muted">{formatTime(t.createdAt)} · {t.cashier.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{formatGHS(t.totalAmount)}</p>
                    <Badge tone={STATUS_TONE[t.status]} className="mt-0.5">
                      {t.status === "COMPLETED" ? "Completed" : t.status.replace("_", " ")}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>

        <div className="lg:col-span-5 lg:order-2 order-1 flex flex-col gap-4">
          <Card className="rounded-2xl">
            <CardBody>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Revenue vs expenditure</h3>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary inline-block" /> Revenue
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-gold inline-block" /> Expenditure
                  </span>
                </div>
              </div>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={data.weeklyTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="date" tickFormatter={(d) => formatDate(d).slice(0, 5)} tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} width={40} />
                    <Tooltip formatter={(value) => formatGHS(Number(value))} labelFormatter={(d) => formatDate(String(d))} />
                    <Bar dataKey="revenue" name="Revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenditure" name="Expenditure" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>

          <Card className="rounded-2xl">
            <CardBody>
              <h3 className="font-semibold mb-3">Best-selling products (7 days)</h3>
              {data.bestSelling.length === 0 ? (
                <p className="text-sm text-muted">No sales recorded in the last 7 days</p>
              ) : (
                <div style={{ width: "100%", height: Math.max(data.bestSelling.length * 36, 120) }}>
                  <ResponsiveContainer>
                    <BarChart data={data.bestSelling} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={140}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 17) + "…" : v)}
                      />
                      <Tooltip formatter={(value) => [`${value} sold`, ""]} />
                      <Bar dataKey="qty" fill="var(--primary-light)" radius={[0, 6, 6, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <Card className="rounded-2xl lg:col-span-3 lg:order-3 order-2">
          <CardBody>
            <h3 className="font-semibold mb-3">Today&apos;s payment mix</h3>
            {paymentTotal <= 0 ? (
              <p className="text-sm text-muted py-8 text-center">No sales recorded yet today</p>
            ) : (
              <>
                <div className="relative" style={{ width: "100%", height: 200 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={paymentData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={3}>
                        {paymentData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatGHS(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-xs text-muted">Total today</p>
                    <p className="text-lg font-bold">{formatGHS(paymentTotal)}</p>
                  </div>
                </div>
                <div className="space-y-1.5 mt-2">
                  {paymentData.map((p) => (
                    <div key={p.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ background: p.color }} />
                        {p.name}
                      </span>
                      <span className="font-medium">
                        {formatGHS(p.value)} · {Math.round((p.value / paymentTotal) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Stock alerts */}
      <div className="px-4 lg:px-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="rounded-2xl">
          <CardBody>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Low stock
            </h3>
            {data.lowStock.length === 0 ? (
              <p className="text-sm text-muted">No products are low on stock</p>
            ) : (
              <ul className="space-y-2">
                {data.lowStock.map((p) => (
                  <li key={p.id} className="flex justify-between text-sm">
                    <span>{p.name}</span>
                    <Badge tone="warning">{p.stockQty} left</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card className="rounded-2xl">
          <CardBody>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-danger" /> Out of stock
            </h3>
            {data.outOfStock.length === 0 ? (
              <p className="text-sm text-muted">No products are out of stock</p>
            ) : (
              <ul className="space-y-2">
                {data.outOfStock.map((p) => (
                  <li key={p.id} className="flex justify-between text-sm">
                    <span>{p.name}</span>
                    <Badge tone="danger">Out of stock</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card className="rounded-2xl">
          <CardBody>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-muted" /> Slow-selling (7 days)
            </h3>
            {data.slowSelling.length === 0 ? (
              <p className="text-sm text-muted">All active products have sold recently</p>
            ) : (
              <ul className="space-y-2">
                {data.slowSelling.map((p) => (
                  <li key={p.productId} className="flex justify-between text-sm">
                    <span>{p.name}</span>
                    <span className="text-muted">No sales</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
