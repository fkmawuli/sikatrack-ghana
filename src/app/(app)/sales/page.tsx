"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { formatGHS } from "@/lib/money";
import { formatDateTime } from "@/lib/datetime";
import type { Sale } from "@/types";
import { Receipt as ReceiptIcon, FileSpreadsheet } from "lucide-react";

const STATUS_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  COMPLETED: "success",
  CANCELLED: "danger",
  PARTIALLY_RETURNED: "warning",
  FULLY_RETURNED: "danger",
};

export default function SalesHistoryPage() {
  const toast = useToast();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", new Date(from).toISOString());
      if (to) params.set("to", new Date(to + "T23:59:59").toISOString());
      if (paymentMethod) params.set("paymentMethod", paymentMethod);
      if (status) params.set("status", status);
      const data = await apiFetch<Sale[]>(`/api/sales?${params.toString()}`);
      setSales(data);
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : "Failed to load sales", "error");
    } finally {
      setLoading(false);
    }
  }, [from, to, paymentMethod, status, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = sales.filter((s) => {
    if (!q) return true;
    const query = q.toLowerCase();
    return (
      s.receiptNumber.toLowerCase().includes(query) ||
      s.customerName?.toLowerCase().includes(query) ||
      s.customerPhone?.includes(query)
    );
  });

  function downloadExcel() {
    const params = new URLSearchParams();
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to + "T23:59:59").toISOString());
    if (paymentMethod) params.set("paymentMethod", paymentMethod);
    if (status) params.set("status", status);
    window.location.href = `/api/sales/export?${params.toString()}`;
  }

  return (
    <div className="pb-6">
      <PageHeader
        title="Sales History"
        subtitle={`${filtered.length} transaction${filtered.length === 1 ? "" : "s"}`}
        actions={
          <Button variant="secondary" size="sm" onClick={downloadExcel} disabled={sales.length === 0}>
            <FileSpreadsheet className="h-4 w-4" /> Download Excel
          </Button>
        }
      />

      <div className="px-4 lg:px-6 grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
        <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
          <option value="">All payment methods</option>
          <option value="CASH">Cash</option>
          <option value="MOMO">Mobile Money</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="PARTIALLY_RETURNED">Partially returned</option>
          <option value="FULLY_RETURNED">Fully returned</option>
        </Select>
        <Input placeholder="Search receipt/customer" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="px-4 lg:px-6">
        {loading ? (
          <p className="text-center text-muted py-8">Loading…</p>
        ) : filtered.length === 0 ? (
          <Card>
            <CardBody className="text-center py-12">
              <ReceiptIcon className="h-10 w-10 text-muted mx-auto mb-2" />
              <p className="text-muted">No sales found</p>
            </CardBody>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background text-muted text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Receipt</th>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Cashier</th>
                    <th className="text-left px-4 py-3 font-medium">Payment</th>
                    <th className="text-right px-4 py-3 font-medium">Total</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-background">
                      <td className="px-4 py-3">
                        <Link href={`/sales/${s.id}`} className="font-medium text-primary hover:underline">
                          {s.receiptNumber}
                        </Link>
                        {s.customerName && <p className="text-xs text-muted">{s.customerName}</p>}
                      </td>
                      <td className="px-4 py-3 text-muted">{formatDateTime(s.createdAt)}</td>
                      <td className="px-4 py-3 text-muted">{s.cashier?.name}</td>
                      <td className="px-4 py-3 text-muted">
                        {s.payments.map((p) => p.method.replace("_", " ")).join(", ")}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatGHS(s.totalAmount)}</td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[s.status]}>{s.status.replace("_", " ")}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/sales/${s.id}?reprint=1`} className="text-primary text-xs font-medium hover:underline">
                          Reprint
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
