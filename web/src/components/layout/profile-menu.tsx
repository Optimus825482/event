"use client";

import { ChevronDown, Home, LogOut, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_BUILD, buildLabel } from "@/lib/app-build";
import { cn } from "@/lib/utils";
import { findActiveGroup } from "./active-module";
import { ACCENT_CLASSES } from "./module-accent";
import { NavIcon } from "./nav-icons";
import type { ShellGroup, ShellItem } from "./shell-nav";
import { useSignOut } from "./use-sign-out";

type ProfileMenuProps = {
  username: string;
  /** Doğrulanmış `data:` URL (bkz. features/users/avatar.ts); yoksa simge gösterilir. */
  avatarUrl?: string | null;
  roleLabel: string;
  isAdmin: boolean;
  modules: readonly ShellGroup[];
  general: readonly ShellItem[];
  accent: ShellGroup["accent"];
};

const ITEM = "cursor-pointer gap-2 rounded-md px-3 py-2 text-sm text-slate-300 focus:bg-slate-700 focus:text-white";

/** Profil açılır menüsü: kullanıcı, modül geçişi, genel bağlantılar ve çıkış. */
export function ProfileMenu({ username, avatarUrl = null, roleLabel, isAdmin, modules, general, accent }: ProfileMenuProps) {
  const pathname = usePathname();
  const { pending, signOut } = useSignOut();
  const active = findActiveGroup(modules, pathname);
  const classes = ACCENT_CLASSES[accent];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Profil menüsü"
        className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-white transition-colors hover:bg-slate-700 data-[state=open]:bg-slate-700"
      >
        <Avatar className="h-8 w-8">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback className={cn("flex h-8 w-8 items-center justify-center rounded-full", classes.avatar)}>
            <User aria-hidden="true" className="h-4 w-4 text-white" />
          </AvatarFallback>
        </Avatar>
        <span className="hidden max-w-32 truncate font-medium lg:block">{username}</span>
        <ChevronDown aria-hidden="true" className="h-4 w-4 text-slate-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 border-slate-700 bg-slate-800 p-1 text-slate-300 shadow-xl">
        <DropdownMenuLabel className="space-y-1 px-3 py-2">
          <span className="block truncate text-sm font-medium text-white">{username}</span>
          <span
            className={cn(
              "inline-block rounded-full border px-2 py-0.5 text-xs font-medium",
              isAdmin ? ACCENT_CLASSES.amber.badge : "border-slate-600 bg-slate-700/40 text-slate-300",
            )}
          >
            {roleLabel}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-700" />
        <DropdownMenuItem asChild className={ITEM}>
          <Link href="/">
            <Home aria-hidden="true" className="h-4 w-4" />
            Ana Sayfa
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={ITEM}>
          <Link href="/profile">
            <User aria-hidden="true" className="h-4 w-4" />
            Profilim
          </Link>
        </DropdownMenuItem>
        {general.map((item) => (
          <DropdownMenuItem key={item.href} asChild className={ITEM}>
            <Link href={item.href}>
              <NavIcon name={item.icon} className="h-4 w-4" />
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
        {modules.length > 1 && (
          <>
            <DropdownMenuSeparator className="bg-slate-700" />
            <DropdownMenuLabel className="px-3 py-1 text-xs tracking-wider text-slate-500 uppercase">Modüller</DropdownMenuLabel>
            {modules.map((group) => {
              const first = group.items[0];
              if (!first) return null;
              const isActive = active?.key === group.key;
              return (
                <DropdownMenuItem
                  key={group.key}
                  asChild
                  className={cn(ITEM, isActive && ACCENT_CLASSES[group.accent].menuActive)}
                >
                  <Link href={first.href} aria-current={isActive ? "true" : undefined}>
                    <NavIcon name={group.icon} className={cn("h-4 w-4", ACCENT_CLASSES[group.accent].icon)} />
                    {group.label}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </>
        )}
        <DropdownMenuSeparator className="bg-slate-700" />
        <DropdownMenuItem
          disabled={pending}
          onSelect={() => void signOut()}
          className="cursor-pointer gap-2 rounded-md px-3 py-2 text-sm text-red-400 focus:bg-red-500/10 focus:text-red-300"
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
          {pending ? "Çıkış yapılıyor…" : "Çıkış yap"}
        </DropdownMenuItem>
        {APP_BUILD && (
          <DropdownMenuLabel className="px-3 pt-2 pb-1 text-xs font-normal text-slate-500">Güncelleme {buildLabel(APP_BUILD)}</DropdownMenuLabel>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
