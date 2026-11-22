"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { buildCrumbs, findActiveGroup } from "./active-module";
import { ACCENT_CLASSES } from "./module-accent";
import { NavIcon } from "./nav-icons";
import type { ShellGroup } from "./shell-nav";

/** Navbar altındaki kırıntı satırı: modül rozeti → sayfa yolu pilleri. */
export function Breadcrumbs({ modules, linkable }: { modules: readonly ShellGroup[]; linkable: readonly string[] }) {
  const pathname = usePathname();
  const group = findActiveGroup(modules, pathname);
  const crumbs = buildCrumbs(pathname, new Set(linkable));
  if (!group) return null;
  const accent = ACCENT_CLASSES[group.accent];

  return (
    <nav aria-label="Sayfa yolu" className="hidden h-10 items-center md:flex">
      <ol className="flex min-w-0 items-center gap-2 text-sm">
        <li>
          <span className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium", accent.badge)}>
            <NavIcon name={group.icon} className="h-3.5 w-3.5" />
            {group.label}
          </span>
        </li>
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={`${index}-${crumb.label}`} className="flex items-center gap-2">
              <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-slate-600" />
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={cn("rounded-full px-3 py-1 text-xs", last ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-400")}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
