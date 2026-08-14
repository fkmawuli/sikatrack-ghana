"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { toNumber } from "@/lib/money";
import { formatDateTime } from "@/lib/datetime";
import { can } from "@/lib/rbac";
import type { Product, StockMovement } from "@/types";
import { PackagePlus, ClipboardEdit } from "lucide-react";

const MOVEMENT_LABELS: Record<string, string> = {
  OPENING: "Opening stock",
  RECEIVED: "Stock received",
  SALE: "Sale",
  RETURN: "Return",
  DAMAGED: "Damaged",
  EXPIRED: "Expired",
  MISSING: "Missing",
  ADJUSTMENT: "Adjustment",
  CORRECTION: "Correction",
};

export default function StockPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const toast = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [receiveForm, setReceiveForm] = useState({ productId: "", quantity: "", referenceNumber: "", reason: "" });
  const [adjustForm, setAdjustForm] = useState({ productId: "", type: "DAMAGED", quantity: "", reason: "" });

  const canReceive = role ? can(role, "stock.receive") : false;
  const canAdjust = role ? can(role, "stock.adjust") : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [productsData, movementsData] = await Promise.all([
        apiFetch<Product[]>("/api/products?status=active"),
        apiFetch<StockMovement[]>("/api/stock/movements?limit=50"),
      ]);
      setProducts(productsData);
      setMovements(movementsData);
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : "Failed to load stock data", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitReceive(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const qty = parseFloat(receiveForm.quantity);
    if (!receiveForm.productId || !qty || qty <= 0) {
      setError("Select a product and enter a valid quantity");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/stock/receive", {
        method: "POST",
        body: JSON.stringify({
          productId: receiveForm.productId,
          quantity: qty,
          referenceNumber: receiveForm.referenceNumber || undefined,
          reason: receiveForm.reason || undefined,
        }),
      });
      toast.show("Stock received", "success");
      setReceiveOpen(false);
      setReceiveForm({ productId: "", quantity: "", referenceNumber: "", reason: "" });
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to receive stock");
    } finally {
      setSaving(false);
    }
  }

  async function submitAdjust(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const qty = parseFloat(adjustForm.quantity);
    if (!adjustForm.productId || !qty || qty === 0) {
      setError("Select a product and enter a valid quantity");
      return;
    }
    if (!adjustForm.reason.trim()) {
      setError("A reason is required for stock adjustments");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/stock/adjust", {
        method: "POST",
        body: JSON.stringify({
          productId: adjustForm.productId,
          type: adjustForm.type,
          quantity: qty,
          reason: adjustForm.reason,
        }),
      });
      toast.show("Stock adjusted", "success");
      setAdjustOpen(false);
      setAdjustForm({ productId: "", type: "DAMAGED", quantity: "", reason: "" });
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to adjust stock");
    } finally {
      setSaving(false);
    }
  }

  const lowStock = products.filter((p) => toNumber(p.stockQty) > 0 && toNumber(p.stockQty) <= toNumber(p.reorderLevel));
  const outOfStock = products.filter((p) => toNumber(p.stockQty) <= 0);

  return (
    <div className="pb-6">
      <PageHeader
        title="Stock Management"
        subtitle="Stock levels, receiving and corrections"
        actions={
          <>
            {canReceive && (
              <Button size="sm" onClick={() => setReceiveOpen(true)}>
                <PackagePlus className="h-4 w-4" /> Receive stock
              </Button>
            )}
            {canAdjust && (
              <Button size="sm" variant="secondary" onClick={() => setAdjustOpen(true)}>
                <ClipboardEdit className="h-4 w-4" /> Adjust stock
              </Button>
            )}
          </>
        }
      />

      <div className="px-4 lg:px-6 grid grid-cols-2 gap-3 mb-4">
        <Card>
          <CardBody className="text-center py-3">
            <p className="text-2xl font-bold text-warning">{lowStock.length}</p>
            <p className="text-xs text-muted">Low stock</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center py-3">
            <p className="text-2xl font-bold text-danger">{outOfStock.length}</p>
            <p className="text-xs text-muted">Out of stock</p>
          </CardBody>
        </Card>
      </div>

      <div className="px-4 lg:px-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Stock levels</div>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-background text-muted text-xs uppercase sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Product</th>
                  <th className="text-right px-4 py-2 font-medium">Stock</th>
                  <th className="text-right px-4 py-2 font-medium">Reorder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-muted">Loading…</td>
                  </tr>
                ) : (
                  products.map((p) => {
                    const qty = toNumber(p.stockQty);
                    const reorder = toNumber(p.reorderLevel);
                    const tone = qty <= 0 ? "danger" : qty <= reorder ? "warning" : "success";
                    return (
                      <tr key={p.id}>
                        <td className="px-4 py-2">{p.name}</td>
                        <td className="px-4 py-2 text-right">
                          <Badge tone={tone}>
                            {qty} {p.unit}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-right text-muted">{reorder}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Recent stock movements</div>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-background text-muted text-xs uppercase sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Product</th>
                  <th className="text-left px-4 py-2 font-medium">Type</th>
                  <th className="text-right px-4 py-2 font-medium">Qty</th>
                  <th className="text-right px-4 py-2 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2">
                      <p>{m.product.name}</p>
                      <p className="text-xs text-muted">
                        {formatDateTime(m.createdAt)} · {m.user.name}
                      </p>
                    </td>
                    <td className="px-4 py-2">{MOVEMENT_LABELS[m.type] || m.type}</td>
                    <td className="px-4 py-2 text-right">
                      {toNumber(m.quantity) > 0 ? "+" : ""}
                      {toNumber(m.quantity)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{toNumber(m.newBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal open={receiveOpen} onClose={() => setReceiveOpen(false)} title="Receive stock">
        <form onSubmit={submitReceive} className="space-y-4">
          <div>
            <Label htmlFor="rp">Product</Label>
            <Select
              id="rp"
              value={receiveForm.productId}
              onChange={(e) => setReceiveForm({ ...receiveForm, productId: e.target.value })}
              required
            >
              <option value="">— Select product —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({toNumber(p.stockQty)} {p.unit} in stock)
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="rq">Quantity received</Label>
            <Input
              id="rq"
              type="number"
              step="0.001"
              min="0"
              value={receiveForm.quantity}
              onChange={(e) => setReceiveForm({ ...receiveForm, quantity: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="ref">Reference / invoice number (optional)</Label>
            <Input
              id="ref"
              value={receiveForm.referenceNumber}
              onChange={(e) => setReceiveForm({ ...receiveForm, referenceNumber: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="rr">Note (optional)</Label>
            <Textarea
              id="rr"
              value={receiveForm.reason}
              onChange={(e) => setReceiveForm({ ...receiveForm, reason: e.target.value })}
            />
          </div>
          <FieldError>{error ?? undefined}</FieldError>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setReceiveOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Receive stock
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={adjustOpen} onClose={() => setAdjustOpen(false)} title="Adjust stock">
        <form onSubmit={submitAdjust} className="space-y-4">
          <div>
            <Label htmlFor="ap">Product</Label>
            <Select
              id="ap"
              value={adjustForm.productId}
              onChange={(e) => setAdjustForm({ ...adjustForm, productId: e.target.value })}
              required
            >
              <option value="">— Select product —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({toNumber(p.stockQty)} {p.unit} in stock)
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="at">Adjustment type</Label>
            <Select
              id="at"
              value={adjustForm.type}
              onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}
            >
              <option value="DAMAGED">Damaged</option>
              <option value="EXPIRED">Expired</option>
              <option value="MISSING">Missing / lost</option>
              <option value="CORRECTION">Correction (count adjustment)</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="aq">
              {adjustForm.type === "CORRECTION" ? "Adjustment (+ to add, - to remove)" : "Quantity"}
            </Label>
            <Input
              id="aq"
              type="number"
              step="0.001"
              value={adjustForm.quantity}
              onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="ar">Reason (required)</Label>
            <Textarea
              id="ar"
              value={adjustForm.reason}
              onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
              required
            />
          </div>
          <FieldError>{error ?? undefined}</FieldError>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setAdjustOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={saving}>
              Save adjustment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
