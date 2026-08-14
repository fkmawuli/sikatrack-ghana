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
import { formatGHS, addGHS, roundGHS } from "@/lib/money";
import { formatDate } from "@/lib/datetime";
import { can } from "@/lib/rbac";
import type { Expense, ExpenseCategory, PaymentMethod } from "@/types";
import { Plus, Wallet } from "lucide-react";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  MOMO: "Mobile Money",
  BANK_TRANSFER: "Bank Transfer",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExpenditurePage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const toast = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    categoryId: "",
    newCategory: "",
    description: "",
    amount: "",
    paymentMethod: "CASH" as PaymentMethod,
    payee: "",
    referenceNumber: "",
    isPersonalWithdrawal: false,
    expenseDate: todayStr(),
  });

  const canRecord = role ? can(role, "expenditure.record") : false;
  const canManageCategories = role ? can(role, "settings.manage") : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", new Date(from).toISOString());
      if (to) params.set("to", new Date(to + "T23:59:59").toISOString());
      const [expensesData, categoriesData] = await Promise.all([
        apiFetch<Expense[]>(`/api/expenses?${params.toString()}`),
        apiFetch<ExpenseCategory[]>("/api/expense-categories"),
      ]);
      setExpenses(expensesData);
      setCategories(categoriesData);
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : "Failed to load expenditure", "error");
    } finally {
      setLoading(false);
    }
  }, [from, to, toast]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setForm({
      categoryId: categories[0]?.id || "",
      newCategory: "",
      description: "",
      amount: "",
      paymentMethod: "CASH",
      payee: "",
      referenceNumber: "",
      isPersonalWithdrawal: false,
      expenseDate: todayStr(),
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amount = parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!form.description.trim()) {
      setError("Enter a description");
      return;
    }
    setSaving(true);
    try {
      let categoryId = form.categoryId;
      if (!categoryId && form.newCategory.trim() && canManageCategories) {
        const cat = await apiFetch<ExpenseCategory>("/api/expense-categories", {
          method: "POST",
          body: JSON.stringify({ name: form.newCategory.trim() }),
        });
        categoryId = cat.id;
      }
      if (!categoryId) {
        setError("Select a category");
        setSaving(false);
        return;
      }
      await apiFetch("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          description: form.description,
          amount,
          paymentMethod: form.paymentMethod,
          payee: form.payee || undefined,
          referenceNumber: form.referenceNumber || undefined,
          isPersonalWithdrawal: form.isPersonalWithdrawal,
          expenseDate: new Date(form.expenseDate).toISOString(),
        }),
      });
      toast.show("Expense recorded", "success");
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to record expense");
    } finally {
      setSaving(false);
    }
  }

  const operating = expenses.filter((e) => !e.isPersonalWithdrawal);
  const withdrawals = expenses.filter((e) => e.isPersonalWithdrawal);
  const operatingTotal = roundGHS(addGHS(...operating.map((e) => parseFloat(e.amount))));
  const withdrawalTotal = roundGHS(addGHS(...withdrawals.map((e) => parseFloat(e.amount))));

  return (
    <div className="pb-6">
      <PageHeader
        title="Expenditure"
        subtitle="Record and track business spending"
        actions={
          canRecord ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Record expense
            </Button>
          ) : null
        }
      />

      <div className="px-4 lg:px-6 grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-danger-light flex items-center justify-center">
              <Wallet className="h-5 w-5 text-danger" />
            </div>
            <div>
              <p className="text-xs text-muted">Operating expenditure</p>
              <p className="text-xl font-bold">{formatGHS(operatingTotal)}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gold-light flex items-center justify-center">
              <Wallet className="h-5 w-5 text-gold-dark" />
            </div>
            <div>
              <p className="text-xs text-muted">Personal withdrawals (not an expense)</p>
              <p className="text-xl font-bold">{formatGHS(withdrawalTotal)}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="px-4 lg:px-6 grid grid-cols-2 gap-2 mb-4 max-w-md">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
      </div>

      <div className="px-4 lg:px-6">
        {loading ? (
          <p className="text-center text-muted py-8">Loading…</p>
        ) : expenses.length === 0 ? (
          <Card>
            <CardBody className="text-center py-12 text-muted">No expenses recorded</CardBody>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background text-muted text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Category</th>
                    <th className="text-left px-4 py-3 font-medium">Description</th>
                    <th className="text-left px-4 py-3 font-medium">Payment</th>
                    <th className="text-right px-4 py-3 font-medium">Amount</th>
                    <th className="text-left px-4 py-3 font-medium">Recorded by</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {expenses.map((e) => (
                    <tr key={e.id}>
                      <td className="px-4 py-3 text-muted">{formatDate(e.expenseDate)}</td>
                      <td className="px-4 py-3">
                        {e.category.name}
                        {e.isPersonalWithdrawal && (
                          <Badge tone="gold" className="ml-2">
                            Withdrawal
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">{e.description}</td>
                      <td className="px-4 py-3 text-muted">{METHOD_LABELS[e.paymentMethod]}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatGHS(e.amount)}</td>
                      <td className="px-4 py-3 text-muted">{e.user.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record expense">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="cat">Category</Label>
            <Select
              id="cat"
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
          {canManageCategories && (
            <div>
              <Label htmlFor="newCat">Or add new category</Label>
              <Input
                id="newCat"
                value={form.newCategory}
                onChange={(e) => setForm({ ...form, newCategory: e.target.value, categoryId: "" })}
              />
            </div>
          )}
          <div>
            <Label htmlFor="desc">Description</Label>
            <Input
              id="desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amt">Amount (GH₵)</Label>
              <Input
                id="amt"
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="pm">Payment method</Label>
              <Select
                id="pm"
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as PaymentMethod })}
              >
                {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABELS[m]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="payee">Payee (optional)</Label>
              <Input id="payee" value={form.payee} onChange={(e) => setForm({ ...form, payee: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={form.expenseDate}
                onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="refnum">Reference number (optional)</Label>
            <Input
              id="refnum"
              value={form.referenceNumber}
              onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isPersonalWithdrawal}
              onChange={(e) => setForm({ ...form, isPersonalWithdrawal: e.target.checked })}
              className="h-4 w-4"
            />
            This is a personal withdrawal (not a business expense)
          </label>
          <FieldError>{error ?? undefined}</FieldError>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save expense
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
