export const ROLES = [
  "OWNER",
  "MANAGER",
  "CASHIER",
  "STOCK_KEEPER",
  "BOOKKEEPER",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner/Administrator",
  MANAGER: "Manager",
  CASHIER: "Cashier/Sales Attendant",
  STOCK_KEEPER: "Stock Keeper",
  BOOKKEEPER: "Bookkeeper",
};

export type Permission =
  | "sales.create"
  | "sales.view"
  | "sales.cancel"
  | "sales.return.request"
  | "sales.return.approve"
  | "receipts.print"
  | "products.view"
  | "products.manage"
  | "stock.receive"
  | "stock.adjust"
  | "stock.view"
  | "stock.movements.view"
  | "expenditure.record"
  | "expenditure.view"
  | "reports.financial"
  | "reports.stock"
  | "reconciliation.perform"
  | "reconciliation.approve"
  | "users.manage"
  | "settings.manage"
  | "audit.view"
  | "discounts.approve"
  | "dashboard.view";

const PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: [
    "sales.create",
    "sales.view",
    "sales.cancel",
    "sales.return.request",
    "sales.return.approve",
    "receipts.print",
    "products.view",
    "products.manage",
    "stock.receive",
    "stock.adjust",
    "stock.view",
    "stock.movements.view",
    "expenditure.record",
    "expenditure.view",
    "reports.financial",
    "reports.stock",
    "reconciliation.perform",
    "reconciliation.approve",
    "users.manage",
    "settings.manage",
    "audit.view",
    "discounts.approve",
    "dashboard.view",
  ],
  MANAGER: [
    "sales.create",
    "sales.view",
    "sales.cancel",
    "sales.return.request",
    "sales.return.approve",
    "receipts.print",
    "products.view",
    "products.manage",
    "stock.receive",
    "stock.adjust",
    "stock.view",
    "stock.movements.view",
    "expenditure.record",
    "expenditure.view",
    "reports.financial",
    "reports.stock",
    "reconciliation.perform",
    "reconciliation.approve",
    "discounts.approve",
    "dashboard.view",
  ],
  CASHIER: [
    "sales.create",
    "sales.view",
    "sales.return.request",
    "receipts.print",
    "products.view",
    "stock.view",
    "dashboard.view",
  ],
  STOCK_KEEPER: [
    "products.view",
    "products.manage",
    "stock.receive",
    "stock.adjust",
    "stock.view",
    "stock.movements.view",
    "dashboard.view",
  ],
  BOOKKEEPER: [
    "sales.view",
    "expenditure.view",
    "reports.financial",
    "products.view",
    "stock.view",
    "dashboard.view",
  ],
};

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canAny(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}

/** Maps app routes to the permission required to view them. Used by middleware and nav. */
export const PAGE_PERMISSIONS: { path: string; permission: Permission }[] = [
  { path: "/dashboard", permission: "dashboard.view" },
  { path: "/pos", permission: "sales.create" },
  { path: "/sales", permission: "sales.view" },
  { path: "/products", permission: "products.view" },
  { path: "/stock", permission: "stock.view" },
  { path: "/stock/movements", permission: "stock.movements.view" },
  { path: "/expenditure", permission: "expenditure.view" },
  { path: "/reports", permission: "reports.financial" },
  { path: "/reconciliation", permission: "reconciliation.perform" },
  { path: "/users", permission: "users.manage" },
  { path: "/settings", permission: "settings.manage" },
  { path: "/audit-log", permission: "audit.view" },
];

export function findRequiredPermission(pathname: string): Permission | null {
  const match = PAGE_PERMISSIONS.filter((p) => pathname.startsWith(p.path)).sort(
    (a, b) => b.path.length - a.path.length
  )[0];
  return match?.permission ?? null;
}
