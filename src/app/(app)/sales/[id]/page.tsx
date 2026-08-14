"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useReactToPrint } from "react-to-print";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { Select, Textarea, Label, FieldError } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { can } from "@/lib/rbac";
import Receipt from "@/components/receipt/Receipt";
import type { Sale } from "@/types";
import { Printer, XCircle, RotateCcw, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface BusinessResponse {
  name: string;
  phone: string | null;
  location: string | null;
  taxId: string | null;
  logoUrl: string | null;
  settings: {
    defaultReceiptSize: "58mm" | "80mm" | "A4";
    receiptFooterMessage: string | null;
    returnPolicy: string | null;
    showReprintLabel: boolean;
  };
}

const STATUS_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  COMPLETED: "success",
  CANCELLED: "danger",
  PARTIALLY_RETURNED: "warning",
  FULLY_RETURNED: "danger",
};

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const isReprint = searchParams.get("reprint") === "1";
  const { data: session } = useSession();
  const role = session?.user?.role;
  const toast = useToast();

  const [sale, setSale] = useState<Sale | null>(null);
  const [business, setBusiness] = useState<BusinessResponse | null>(null);
  const [size, setSize] = useState<"58mm" | "80mm" | "A4">("80mm");
  const [loading, setLoading] = useState(true);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnQtys, setReturnQtys] = useState<Record<string, string>>({});
  const [returnReason, setReturnReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);
  const reactToPrint = useReactToPrint({ contentRef: printRef });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [saleData, businessData] = await Promise.all([
        apiFetch<Sale>(`/api/sales/${id}`),
        apiFetch<BusinessResponse>("/api/business"),
      ]);
      setSale(saleData);
      setBusiness(businessData);
      setSize(businessData.settings?.defaultReceiptSize ?? "80mm");
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : "Failed to load receipt", "error");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const canCancel = role ? can(role, "sales.cancel") : false;
  const canReturn = role ? can(role, "sales.return.approve") : false;

  async function submitCancel(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    if (!cancelReason.trim()) {
      setActionError("A reason is required");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/api/sales/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: cancelReason }),
      });
      toast.show("Sale cancelled and stock restored", "success");
      setCancelOpen(false);
      setCancelReason("");
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Failed to cancel sale");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReturn(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    if (!sale) return;
    if (!returnReason.trim()) {
      setActionError("A reason is required");
      return;
    }
    const items = Object.entries(returnQtys)
      .map(([saleItemId, qty]) => ({ saleItemId, quantity: parseFloat(qty) || 0, restock: true }))
      .filter((i) => i.quantity > 0);
    if (items.length === 0) {
      setActionError("Enter a quantity to return for at least one item");
      return;
    }
    const allReturned = sale.items.every((si) => {
      const remaining = parseFloat(si.quantity) - parseFloat(si.returnedQuantity);
      const returning = items.find((i) => i.saleItemId === si.id)?.quantity ?? 0;
      return returning >= remaining;
    });
    setSubmitting(true);
    try {
      await apiFetch(`/api/sales/${id}/return`, {
        method: "POST",
        body: JSON.stringify({
          type: allReturned ? "FULL_RETURN" : "PARTIAL_RETURN",
          reason: returnReason,
          items,
        }),
      });
      toast.show("Return processed and stock restored", "success");
      setReturnOpen(false);
      setReturnQtys({});
      setReturnReason("");
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Failed to process return");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !sale || !business) {
    return <p className="text-center text-muted py-16">Loading receipt…</p>;
  }

  const canActOnSale = sale.status === "COMPLETED" || sale.status === "PARTIALLY_RETURNED";

  return (
    <div className="pb-10">
      <div className="no-print px-4 lg:px-6 pt-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/sales" className="text-muted hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Receipt {sale.receiptNumber}</h1>
            <Badge tone={STATUS_TONE[sale.status]}>{sale.status.replace("_", " ")}</Badge>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={size} onChange={(e) => setSize(e.target.value as typeof size)} className="w-auto">
            <option value="58mm">58mm thermal</option>
            <option value="80mm">80mm thermal</option>
            <option value="A4">A4</option>
          </Select>
          <Button variant="secondary" onClick={() => reactToPrint()}>
            <Printer className="h-4 w-4" /> Print / Save PDF
          </Button>
          {canActOnSale && canReturn && (
            <Button variant="secondary" onClick={() => setReturnOpen(true)}>
              <RotateCcw className="h-4 w-4" /> Return
            </Button>
          )}
          {sale.status === "COMPLETED" && canCancel && (
            <Button variant="danger" onClick={() => setCancelOpen(true)}>
              <XCircle className="h-4 w-4" /> Cancel sale
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 border border-border rounded-xl overflow-hidden shadow-sm w-fit mx-auto">
        <Receipt
          ref={printRef}
          sale={sale}
          business={business}
          settings={business.settings}
          size={size}
          isReprint={isReprint}
        />
      </div>

      {sale.status !== "COMPLETED" && (
        <p className="no-print text-center text-sm text-muted mt-4">
          This sale is {sale.status.replace("_", " ").toLowerCase()}. See stock movements for restock detail.
        </p>
      )}

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel sale">
        <form onSubmit={submitCancel} className="space-y-4">
          <p className="text-sm text-muted">
            This will cancel the sale, restore all items to stock, and cannot be undone. The original
            transaction remains on record.
          </p>
          <div>
            <Label htmlFor="cr">Reason for cancellation</Label>
            <Textarea id="cr" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} required />
          </div>
          <FieldError>{actionError ?? undefined}</FieldError>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setCancelOpen(false)}>
              Back
            </Button>
            <Button type="submit" variant="danger" loading={submitting}>
              Confirm cancellation
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={returnOpen} onClose={() => setReturnOpen(false)} title="Process return" size="lg">
        <form onSubmit={submitReturn} className="space-y-4">
          <p className="text-sm text-muted">Enter the quantity being returned for each item.</p>
          <div className="space-y-2">
            {sale.items.map((item) => {
              const remaining = parseFloat(item.quantity) - parseFloat(item.returnedQuantity);
              if (remaining <= 0) return null;
              return (
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{item.productName}</p>
                    <p className="text-xs text-muted">{remaining} available to return</p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={remaining}
                    step="0.001"
                    className="w-24 rounded-lg border border-border px-2 py-1.5"
                    value={returnQtys[item.id] || ""}
                    onChange={(e) => setReturnQtys({ ...returnQtys, [item.id]: e.target.value })}
                  />
                </div>
              );
            })}
          </div>
          <div>
            <Label htmlFor="rr">Reason for return</Label>
            <Textarea id="rr" value={returnReason} onChange={(e) => setReturnReason(e.target.value)} required />
          </div>
          <FieldError>{actionError ?? undefined}</FieldError>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setReturnOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Confirm return
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
