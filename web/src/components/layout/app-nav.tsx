"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type AppNavItem = { href: string; label: string };

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Menü öğeleri `features/auth/nav.ts` listesinden süzülüp düzende buraya verilir. */
export function AppNav({ items }: { items: readonly AppNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Ana menü" className="flex gap-1 overflow-x-auto p-2 md:flex-col md:overflow-visible">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              active && "bg-accent text-accent-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
