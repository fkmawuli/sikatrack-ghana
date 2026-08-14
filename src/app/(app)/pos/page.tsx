"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { formatGHS, toNumber, addGHS, subtractGHS, roundGHS } from "@/lib/money";
import { can } from "@/lib/rbac";
import type { Product, Category, PaymentMethod } from "@/types";
import { Search, Plus, Minus, Trash2, ShoppingCart, X } from "lucide-react";

interface CartLine {
  productId: string;
  name: string;
  unitPrice: number;
  stockQty: number;
  unit: string;
  quantity: number;
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  MOMO: "Mobile Money",
  BANK_TRANSFER: "Bank Transfer",
};

export default function PosPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const router = useRouter();
  const toast = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [negativeStockAllowed, setNegativeStockAllowed] = useState(false);

  const [discountAmount, setDiscountAmount] = useState("0");
  const [discountReason, setDiscountReason] = useState("");
  const [paymentMode, setPaymentMode] = useState<"SINGLE" | "MIXED">("SINGLE");
  const [singleMethod, setSingleMethod] = useState<PaymentMethod>("CASH");
  const [singleAmount, setSingleAmount] = useState("");
  const [mixedPayments, setMixedPayments] = useState<{ method: PaymentMethod; amount: string }[]>([
    { method: "CASH", amount: "" },
    { method: "MOMO", amount: "" },
  ]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canDiscount = role ? can(role, "discounts.approve") : false;

  const loadProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status: "active" });
      if (q) params.set("q", q);
      if (categoryId) params.set("categoryId", categoryId);
      const data = await apiFetch<Product[]>(`/api/products?${params.toString()}`);
      setProducts(data);
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : "Failed to load products", "error");
    }
  }, [q, categoryId, toast]);

  useEffect(() => {
    const t = setTimeout(loadProducts, 200);
    return () => clearTimeout(t);
  }, [loadProducts]);

  useEffect(() => {
    apiFetch<Category[]>("/api/categories").then(setCategories).catch(() => {});
    apiFetch<{ settings: { negativeStockAllowed: boolean } }>("/api/business")
      .then((b) => setNegativeStockAllowed(b.settings?.negativeStockAllowed ?? false))
      .catch(() => {});
  }, []);

  const subtotal = useMemo(
    () => roundGHS(addGHS(...cart.map((l) => l.unitPrice * l.quantity))),
    [cart]
  );
  const discount = parseFloat(discountAmount) || 0;
  const total = useMemo(() => Math.max(0, roundGHS(subtractGHS(subtotal, discount))), [subtotal, discount]);

  const amountReceived = useMemo(() => {
    if (paymentMode === "SINGLE") return parseFloat(singleAmount) || 0;
    return roundGHS(addGHS(...mixedPayments.map((p) => parseFloat(p.amount) || 0)));
  }, [paymentMode, singleAmount, mixedPayments]);
  const changeGiven = Math.max(0, roundGHS(subtractGHS(amountReceived, total)));

  function addToCart(product: Product) {
    const available = toNumber(product.stockQty);
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      const nextQty = (existing?.quantity || 0) + 1;
      if (!negativeStockAllowed && nextQty > available) {
        toast.show(`Only ${available} ${product.unit} of ${product.name} available`, "warning");
        return prev;
      }
      if (existing) {
        return prev.map((l) => (l.productId === product.id ? { ...l, quantity: nextQty } : l));
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: toNumber(product.sellingPrice),
          stockQty: available,
          unit: product.unit,
          quantity: 1,
        },
      ];
    });
  }

  function updateQty(productId: string, quantity: number) {
    setCart((prev) => {
      if (quantity <= 0) return prev.filter((l) => l.productId !== productId);
      return prev.map((l) => {
        if (l.productId !== productId) return l;
        if (!negativeStockAllowed && quantity > l.stockQty) {
          toast.show(`Only ${l.stockQty} ${l.unit} available`, "warning");
          return l;
        }
        return { ...l, quantity };
      });
    });
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }

  function resetCheckoutFields() {
    setDiscountAmount("0");
    setDiscountReason("");
    setPaymentMode("SINGLE");
    setSingleMethod("CASH");
    setSingleAmount("");
    setMixedPayments([{ method: "CASH", amount: "" }, { method: "MOMO", amount: "" }]);
    setCustomerName("");
    setCustomerPhone("");
    setNote("");
  }

  async function completeSale() {
    setError(null);
    if (cart.length === 0) {
      setError("Add at least one product to the cart");
      return;
    }
    if (discount > 0 && !discountReason.trim()) {
      setError("Enter a reason for the discount");
      return;
    }

    const payments =
      paymentMode === "SINGLE"
        ? [{ method: singleMethod, amount: parseFloat(singleAmount) || 0 }]
        : mixedPayments
            .filter((p) => (parseFloat(p.amount) || 0) > 0)
            .map((p) => ({ method: p.method, amount: parseFloat(p.amount) || 0 }));

    if (payments.length === 0 || payments.some((p) => p.amount <= 0)) {
      setError("Enter the amount received for the selected payment method(s)");
      return;
    }
    const paid = roundGHS(addGHS(...payments.map((p) => p.amount)));
    if (paid < total - 0.005) {
      setError(`Amount received (${formatGHS(paid)}) is less than the total due (${formatGHS(total)})`);
      return;
    }

    setSubmitting(true);
    try {
      const sale = await apiFetch<{ id: string }>("/api/sales", {
        method: "POST",
        body: JSON.stringify({
          items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
          discountAmount: discount,
          discountReason: discount > 0 ? discountReason : undefined,
          payments,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          note: note || undefined,
        }),
      });
      toast.show("Sale completed", "success");
      setCart([]);
      resetCheckoutFields();
      setCartOpen(false);
      router.push(`/sales/${sale.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to complete sale");
    } finally {
      setSubmitting(false);
    }
  }

  const cartPanel = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="font-semibold">Cart ({cart.length})</h2>
        <button onClick={() => setCartOpen(false)} className="lg:hidden h-8 w-8 flex items-center justify-center">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        {cart.length === 0 ? (
          <p className="text-muted text-sm text-center py-8">Cart is empty. Tap a product to add it.</p>
        ) : (
          cart.map((line) => (
            <div key={line.productId} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{line.name}</p>
                <p className="text-xs text-muted">{formatGHS(line.unitPrice)} / {line.unit}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateQty(line.productId, line.quantity - 1)}
                  className="h-8 w-8 rounded-lg border border-border flex items-center justify-center"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  value={line.quantity}
                  onChange={(e) => updateQty(line.productId, parseFloat(e.target.value) || 0)}
                  className="w-12 text-center text-sm border border-border rounded-lg py-1"
                />
                <button
                  onClick={() => updateQty(line.productId, line.quantity + 1)}
                  className="h-8 w-8 rounded-lg border border-border flex items-center justify-center"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <p className="w-20 text-right text-sm font-medium">{formatGHS(line.unitPrice * line.quantity)}</p>
              <button onClick={() => removeFromCart(line.productId)} className="text-danger p-1">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border px-4 py-3 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted">Subtotal</span>
          <span>{formatGHS(subtotal)}</span>
        </div>

        {canDiscount && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="discount">Discount (GH₵)</Label>
              <Input
                id="discount"
                type="number"
                min="0"
                step="0.01"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="discountReason">Reason</Label>
              <Input
                id="discountReason"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="e.g. loyal customer"
              />
            </div>
          </div>
        )}

        <div className="flex justify-between font-semibold text-lg">
          <span>Total</span>
          <span>{formatGHS(total)}</span>
        </div>

        <div>
          <Label>Payment method</Label>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => setPaymentMode("SINGLE")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium border ${paymentMode === "SINGLE" ? "bg-primary text-white border-primary" : "border-border"}`}
            >
              Single
            </button>
            <button
              type="button"
              onClick={() => setPaymentMode("MIXED")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium border ${paymentMode === "MIXED" ? "bg-primary text-white border-primary" : "border-border"}`}
            >
              Mixed
            </button>
          </div>

          {paymentMode === "SINGLE" ? (
            <div className="grid grid-cols-2 gap-2">
              <Select value={singleMethod} onChange={(e) => setSingleMethod(e.target.value as PaymentMethod)}>
                {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABELS[m]}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder={`Amount received`}
                value={singleAmount}
                onChange={(e) => setSingleAmount(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              {mixedPayments.map((p, idx) => (
                <div key={idx} className="grid grid-cols-2 gap-2">
                  <Select
                    value={p.method}
                    onChange={(e) => {
                      const next = [...mixedPayments];
                      next[idx] = { ...next[idx], method: e.target.value as PaymentMethod };
                      setMixedPayments(next);
                    }}
                  >
                    {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                      <option key={m} value={m}>
                        {METHOD_LABELS[m]}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Amount"
                    value={p.amount}
                    onChange={(e) => {
                      const next = [...mixedPayments];
                      next[idx] = { ...next[idx], amount: e.target.value };
                      setMixedPayments(next);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between text-sm mt-2">
            <span className="text-muted">Change</span>
            <span className={changeGiven > 0 ? "text-success font-medium" : ""}>{formatGHS(changeGiven)}</span>
          </div>
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer text-muted">Customer details (optional)</summary>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Input placeholder="Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            <Input placeholder="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>
          <Textarea
            className="mt-2"
            placeholder="Transaction note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </details>

        <FieldError>{error ?? undefined}</FieldError>

        <Button fullWidth size="lg" onClick={completeSale} loading={submitting} disabled={cart.length === 0}>
          Complete Sale · {formatGHS(total)}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-56px)] lg:h-screen">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-3 flex flex-col sm:flex-row gap-2 border-b border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <Input
              placeholder="Search product, SKU or barcode"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setCategoryId("")}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${!categoryId ? "bg-primary text-white border-primary" : "border-border text-muted"}`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${categoryId === c.id ? "bg-primary text-white border-primary" : "border-border text-muted"}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pb-24 lg:pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {products.map((p) => {
              const available = toNumber(p.stockQty);
              const disabled = !negativeStockAllowed && available <= 0;
              return (
                <button
                  key={p.id}
                  onClick={() => !disabled && addToCart(p)}
                  disabled={disabled}
                  className="text-left bg-surface border border-border rounded-xl p-3 hover:border-primary active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <p className="font-medium text-sm text-foreground line-clamp-2 min-h-[2.5rem]">{p.name}</p>
                  <p className="text-primary font-semibold mt-1">{formatGHS(p.sellingPrice)}</p>
                  <div className="mt-1">
                    {available <= 0 ? (
                      <Badge tone="danger">Out of stock</Badge>
                    ) : available <= toNumber(p.reorderLevel) ? (
                      <Badge tone="warning">{available} left</Badge>
                    ) : (
                      <span className="text-xs text-muted">{available} {p.unit} in stock</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {products.length === 0 && <p className="text-center text-muted py-12">No products found</p>}
        </div>

        <button
          onClick={() => setCartOpen(true)}
          className="lg:hidden fixed bottom-20 right-4 z-40 bg-primary text-white rounded-full px-5 py-3.5 shadow-lg flex items-center gap-2 font-semibold"
        >
          <ShoppingCart className="h-5 w-5" />
          {cart.length > 0 ? `${formatGHS(total)}` : "Cart"}
          {cart.length > 0 && (
            <span className="bg-gold text-primary-dark rounded-full h-5 w-5 text-xs flex items-center justify-center">
              {cart.length}
            </span>
          )}
        </button>
      </div>

      <div className="hidden lg:flex w-96 border-l border-border bg-surface shrink-0">{cartPanel}</div>

      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-surface flex flex-col">{cartPanel}</div>
      )}
    </div>
  );
}
