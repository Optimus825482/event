import type { ReactNode } from "react";
import { Navbar } from "./navbar";
import type { ShellNav } from "./shell-nav";

type AppShellProps = {
  username: string;
  avatarUrl?: string | null;
  roleLabel: string;
  isAdmin: boolean;
  nav: ShellNav;
  unreadCount: number;
  showBell: boolean;
  children: ReactNode;
};

/** Eski arayüz kabuğu: yapışkan üst çubuk (modül menüsü, zil, profil) + kırıntı satırı + içerik. */
export function AppShell({ children, ...navbar }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Navbar {...navbar} />
      <main className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">{children}</main>
    </div>
  );
}
