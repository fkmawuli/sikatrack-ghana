"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { Input, Label, Select, FieldError } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { formatGHS, toNumber } from "@/lib/money";
import { can } from "@/lib/rbac";
import type { Product, Category } from "@/types";
import { Search, Plus, Package } from "lucide-react";

type FormState = {
  sku: string;
  barcode: string;
  name: string;
  categoryId: string;
  newCategory: string;
  unit: string;
  costPrice: string;
  sellingPrice: string;
  openingStock: string;
  reorderLevel: string;
  active: boolean;
};

const emptyForm: FormState = {
  sku: "",
  barcode: "",
  name: "",
  categoryId: "",
  newCategory: "",
  unit: "piece",
  costPrice: "",
  sellingPrice: "",
  openingStock: "0",
  reorderLevel: "5",
  active: true,
};

export default function ProductsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const toast = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canManage = role ? can(role, "products.manage") : false;
  const canSeeCost = role ? can(role, "products.manage") || can(role, "reports.financial") : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      const [productsData, categoriesData] = await Promise.all([
        apiFetch<Product[]>(`/api/products?${params.toString()}`),
        apiFetch<Category[]>(`/api/categories`),
      ]);
      setProducts(productsData);
      setCategories(categoriesData);
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : "Failed to load products", "error");
    } finally {
      setLoading(false);
    }
  }, [q, status, toast]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setErrors(null);
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      sku: p.sku,
      barcode: p.barcode || "",
      name: p.name,
      categoryId: p.categoryId || "",
      newCategory: "",
      unit: p.unit,
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      openingStock: p.stockQty,
      reorderLevel: p.reorderLevel,
      active: p.active,
    });
    setErrors(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors(null);

    if (!form.sku.trim() || !form.name.trim()) {
      setErrors("SKU and product name are required");
      return;
    }
    const costPrice = parseFloat(form.costPrice);
    const sellingPrice = parseFloat(form.sellingPrice);
    if (Number.isNaN(costPrice) || Number.isNaN(sellingPrice)) {
      setErrors("Enter valid cost and selling prices");
      return;
    }

    setSaving(true);
    try {
      let categoryId = form.categoryId || null;
      if (form.newCategory.trim()) {
        const cat = await apiFetch<Category>("/api/categories", {
          method: "POST",
          body: JSON.stringify({ name: form.newCategory.trim() }),
        });
        categoryId = cat.id;
      }

      if (editing) {
        await apiFetch(`/api/products/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: form.name,
            barcode: form.barcode || null,
            categoryId,
            unit: form.unit,
            costPrice,
            sellingPrice,
            reorderLevel: parseFloat(form.reorderLevel) || 0,
            active: form.active,
          }),
        });
        toast.show("Product updated", "success");
      } else {
        await apiFetch("/api/products", {
          method: "POST",
          body: JSON.stringify({
            sku: form.sku,
            barcode: form.barcode || null,
            name: form.name,
            categoryId,
            unit: form.unit,
            costPrice,
            sellingPrice,
            openingStock: parseFloat(form.openingStock) || 0,
            reorderLevel: parseFloat(form.reorderLevel) || 0,
          }),
        });
        toast.show("Product added", "success");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setErrors(err instanceof ApiClientError ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  function renderStockBadge(p: Product) {
    const qty = toNumber(p.stockQty);
    const reorder = toNumber(p.reorderLevel);
    if (qty <= 0) return <Badge tone="danger">Out of stock</Badge>;
    if (qty <= reorder) return <Badge tone="warning">Low stock</Badge>;
    return <Badge tone="success">In stock</Badge>;
  }

  return (
    <div className="pb-6">
      <PageHeader
        title="Products"
        subtitle={`${products.length} product${products.length === 1 ? "" : "s"}`}
        actions={
          canManage ? (
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4" /> Add product
            </Button>
          ) : null
        }
      />

      <div className="px-4 lg:px-6 flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <Input
            placeholder="Search by name, SKU or barcode"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-48">
          <option value="">All products</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </Select>
      </div>

      <div className="px-4 lg:px-6">
        {loading ? (
          <p className="text-muted text-sm py-8 text-center">Loading products…</p>
        ) : products.length === 0 ? (
          <Card>
            <CardBody className="text-center py-12">
              <Package className="h-10 w-10 text-muted mx-auto mb-2" />
              <p className="text-muted">No products found</p>
            </CardBody>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background text-muted text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Product</th>
                    <th className="text-left px-4 py-3 font-medium">Category</th>
                    <th className="text-right px-4 py-3 font-medium">Stock</th>
                    {canSeeCost && <th className="text-right px-4 py-3 font-medium">Cost</th>}
                    <th className="text-right px-4 py-3 font-medium">Price</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {products.map((p) => (
                    <tr
                      key={p.id}
                      className={`hover:bg-background ${canManage ? "cursor-pointer" : ""}`}
                      onClick={() => canManage && openEdit(p)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{p.name}</p>
                        <p className="text-xs text-muted">
                          SKU: {p.sku}
                          {p.barcode ? ` · ${p.barcode}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-muted">{p.category?.name || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        {toNumber(p.stockQty)} {p.unit}
                      </td>
                      {canSeeCost && (
                        <td className="px-4 py-3 text-right text-muted">{formatGHS(p.costPrice)}</td>
                      )}
                      <td className="px-4 py-3 text-right font-medium">{formatGHS(p.sellingPrice)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          {renderStockBadge(p)}
                          {!p.active && <Badge tone="neutral">Inactive</Badge>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit product" : "Add product"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={form.sku}
                disabled={!!editing}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="barcode">Barcode (optional)</Label>
              <Input
                id="barcode"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="name">Product name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                id="category"
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value, newCategory: "" })}
              >
                <option value="">— Select category —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="newCategory">Or add new category</Label>
              <Input
                id="newCategory"
                placeholder="e.g. Beverages"
                value={form.newCategory}
                onChange={(e) => setForm({ ...form, newCategory: e.target.value, categoryId: "" })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="unit">Unit of measurement</Label>
              <Select id="unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                <option value="piece">Piece</option>
                <option value="pack">Pack</option>
                <option value="carton">Carton</option>
                <option value="kg">Kg</option>
                <option value="litre">Litre</option>
                <option value="bag">Bag</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="costPrice">Cost price (GH₵)</Label>
              <Input
                id="costPrice"
                type="number"
                step="0.01"
                min="0"
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="sellingPrice">Selling price (GH₵)</Label>
              <Input
                id="sellingPrice"
                type="number"
                step="0.01"
                min="0"
                value={form.sellingPrice}
                onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="openingStock">
                {editing ? "Current stock (use Stock page to adjust)" : "Opening stock"}
              </Label>
              <Input
                id="openingStock"
                type="number"
                step="0.001"
                min="0"
                disabled={!!editing}
                value={form.openingStock}
                onChange={(e) => setForm({ ...form, openingStock: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="reorderLevel">Reorder level</Label>
              <Input
                id="reorderLevel"
                type="number"
                step="0.001"
                min="0"
                value={form.reorderLevel}
                onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
              />
            </div>
          </div>

          {editing && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="h-4 w-4"
              />
              Active (visible for sale)
            </label>
          )}

          <FieldError>{errors ?? undefined}</FieldError>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Save changes" : "Add product"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
