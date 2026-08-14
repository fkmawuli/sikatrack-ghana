"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { NAV_ITEMS } from "@/lib/nav";
import { can, type Role } from "@/lib/rbac";
import { Menu, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

const PRIMARY_HREFS = ["/dashboard", "/pos", "/sales", "/stock"];

export default function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = NAV_ITEMS.filter(
    (item) => PRIMARY_HREFS.includes(item.href) && can(role, item.permission)
  );
  const moreItems = NAV_ITEMS.filter(
    (item) => !PRIMARY_HREFS.includes(item.href) && can(role, item.permission)
  );

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around">
          {primaryItems.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex flex-col items-center gap-0.5 py-2 px-2 min-w-[56px] text-xs font-medium",
                  active ? "text-primary" : "text-muted"
                )}
              >
                <Icon className={clsx("h-6 w-6", active && "stroke-[2.5]")} />
                {item.label === "New Sale" ? "Sell" : item.label}
              </Link>
            );
          })}
          {moreItems.length > 0 && (
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center gap-0.5 py-2 px-2 min-w-[56px] text-xs font-medium text-muted"
            >
              <Menu className="h-6 w-6" />
              More
            </button>
          )}
        </div>
      </nav>

      {moreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50 flex items-end"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="bg-surface w-full rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-border font-semibold">More</div>
            <div className="p-2">
              {moreItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-foreground hover:bg-background"
                  >
                    <Icon className="h-5 w-5 text-primary" />
                    {item.label}
                  </Link>
                );
              })}
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-danger hover:bg-background"
              >
                <LogOut className="h-5 w-5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
