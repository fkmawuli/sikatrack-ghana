import type { Permission } from "@/lib/rbac";
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  Boxes,
  Wallet,
} from "lucide-react";

export const NAV_ITEMS: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission: Permission;
  mobile?: boolean;
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view", mobile: true },
  { href: "/pos", label: "New Sale", icon: ShoppingCart, permission: "sales.create", mobile: true },
  { href: "/sales", label: "Sales History", icon: Receipt, permission: "sales.view", mobile: true },
  { href: "/products", label: "Products", icon: Package, permission: "products.view" },
  { href: "/stock", label: "Stock", icon: Boxes, permission: "stock.view", mobile: true },
  { href: "/expenditure", label: "Expenditure", icon: Wallet, permission: "expenditure.view" },
];
