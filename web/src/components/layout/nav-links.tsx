"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { findActiveGroup, isItemActive } from "./active-module";
import { ACCENT_CLASSES } from "./module-accent";
import { NavIcon } from "./nav-icons";
import type { ShellGroup } from "./shell-nav";

/** Masaüstü menü: etkin modülün öğeleri, modül rengiyle vurgulanır. */
export function NavLinks({ modules }: { modules: readonly ShellGroup[] }) {
  const pathname = usePathname();
  const group = findActiveGroup(modules, pathname);
  if (!group) return null;
  const accent = ACCENT_CLASSES[group.accent];

  return (
    <nav aria-label="Ana menü" className="hidden min-w-0 items-center gap-1 overflow-x-auto md:flex">
      {group.items.map((item) => {
        const active = isItemActive(pathname, item, group.items);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              active ? accent.active : "text-slate-400 hover:bg-slate-800 hover:text-white",
            )}
          >
            <NavIcon name={item.icon} className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
