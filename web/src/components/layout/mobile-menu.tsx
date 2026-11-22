"use client";

import { LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { findActiveGroup, isItemActive } from "./active-module";
import { ACCENT_CLASSES } from "./module-accent";
import { NavIcon } from "./nav-icons";
import type { ShellGroup, ShellItem } from "./shell-nav";
import { useSignOut } from "./use-sign-out";

type MobileMenuProps = {
  username: string;
  roleLabel: string;
  modules: readonly ShellGroup[];
  general: readonly ShellItem[];
};

/** Dar ekran paneli: etkin modül menüsü, genel bağlantılar, modül değiştirme ve çıkış. */
export function MobileMenu({ username, roleLabel, modules, general }: MobileMenuProps) {
  const pathname = usePathname();
  const { pending, signOut } = useSignOut();
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  // Sayfa değişince panel kapanır: açıldığı yol ile şimdiki yol aynıysa açıktır.
  const open = openedAt === pathname;
  const active = findActiveGroup(modules, pathname);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenedAt(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobil-menu-paneli"
        aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
        onClick={() => setOpenedAt(open ? null : pathname)}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
      >
        {open ? <X aria-hidden="true" className="h-6 w-6" /> : <Menu aria-hidden="true" className="h-6 w-6" />}
      </button>
      {open && (
        <div
          id="mobil-menu-paneli"
          className="absolute inset-x-0 top-14 z-50 max-h-[calc(100dvh-3.5rem)] space-y-4 overflow-y-auto border-b border-slate-800 bg-slate-900 px-4 py-4 shadow-xl"
        >
          <p className="text-sm text-slate-400">
            <span className="font-medium text-white">{username}</span> · {roleLabel}
          </p>
          {active && (
            <nav aria-label="Mobil gezinme" className="space-y-1">
              {active.items.map((item) => {
                const isActive = isItemActive(pathname, item, active.items);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium",
                      isActive ? ACCENT_CLASSES[active.accent].active : "text-slate-300 hover:bg-slate-800 hover:text-white",
                    )}
                  >
                    <NavIcon name={item.icon} className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
          {general.length > 0 && (
            <nav aria-label="Genel bağlantılar" className="space-y-1 border-t border-slate-800 pt-3">
              {general.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-base text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <NavIcon name={item.icon} className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
          {modules.length > 1 && (
            <div className="border-t border-slate-800 pt-3">
              <p className="px-3 pb-2 text-xs tracking-wider text-slate-500 uppercase">Modül değiştir</p>
              <div className="flex flex-wrap gap-2">
                {modules.map((group) => {
                  const first = group.items[0];
                  if (!first) return null;
                  const isActive = active?.key === group.key;
                  return (
                    <Link
                      key={group.key}
                      href={first.href}
                      className={cn(
                        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                        isActive ? ACCENT_CLASSES[group.accent].badge : "border-slate-700 text-slate-300",
                      )}
                    >
                      <NavIcon name={group.icon} className="h-4 w-4" />
                      {group.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={pending}
            className="flex w-full items-center gap-3 rounded-lg border-t border-slate-800 px-3 py-3 text-base text-red-400 hover:bg-red-500/10 disabled:opacity-60"
          >
            <LogOut aria-hidden="true" className="h-5 w-5" />
            {pending ? "Çıkış yapılıyor…" : "Çıkış Yap"}
          </button>
        </div>
      )}
    </div>
  );
}
