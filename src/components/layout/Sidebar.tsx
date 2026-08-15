"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { NAV_ITEMS } from "@/lib/nav";
import { can, type Role } from "@/lib/rbac";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export default function Sidebar({
  role,
  businessName,
  userName,
}: {
  role: Role;
  businessName: string;
  userName: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 shrink-0 flex-col bg-primary text-white">
      <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10 shrink-0">
        <div className="h-10 w-10 rounded-xl bg-gold text-primary-dark font-bold flex items-center justify-center text-lg">
          S
        </div>
        <div>
          <p className="font-semibold leading-tight">KudiTrack</p>
          <p className="text-xs text-white/60 truncate max-w-[150px]">{businessName}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.filter((item) => can(role, item.permission)).map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-gold text-primary-dark" : "text-white/85 hover:bg-white/10"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10 shrink-0">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm font-medium truncate">{userName}</p>
          <p className="text-xs text-white/60">{role.replace("_", " ")}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/85 hover:bg-white/10"
        >
          <LogOut className="h-5 w-5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
