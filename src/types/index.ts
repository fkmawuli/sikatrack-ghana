export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  categoryId: string | null;
  category: Category | null;
  unit: string;
  costPrice: string;
  sellingPrice: string;
  stockQty: string;
  reorderLevel: string;
  supplierId: string | null;
  imageUrl: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = "CASH" | "MOMO" | "BANK_TRANSFER";

export interface Payment {
  id: string;
  method: PaymentMethod;
  amount: string;
}

export interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  quantity: string;
  unitPrice: string;
  costPriceAtSale: string;
  lineTotal: string;
  returnedQuantity: string;
}

export type SaleStatus = "COMPLETED" | "CANCELLED" | "PARTIALLY_RETURNED" | "FULLY_RETURNED";

export interface Sale {
  id: string;
  receiptNumber: string;
  cashierId: string;
  cashier?: { name: string };
  customerName: string | null;
  customerPhone: string | null;
  note: string | null;
  subtotal: string;
  discountAmount: string;
  discountReason: string | null;
  totalAmount: string;
  amountReceived: string;
  changeGiven: string;
  status: SaleStatus;
  createdAt: string;
  items: SaleItem[];
  payments: Payment[];
}

export interface StockMovement {
  id: string;
  productId: string;
  product: { name: string; sku: string; unit: string };
  type: string;
  quantity: string;
  previousBalance: string;
  newBalance: string;
  referenceNumber: string | null;
  reason: string | null;
  user: { name: string };
  createdAt: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  categoryId: string;
  category: ExpenseCategory;
  description: string;
  amount: string;
  paymentMethod: PaymentMethod;
  payee: string | null;
  referenceNumber: string | null;
  isPersonalWithdrawal: boolean;
  user: { name: string };
  expenseDate: string;
  createdAt: string;
}
