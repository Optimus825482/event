import type { ReactNode } from "react";
import { AppNav, type AppNavItem } from "./app-nav";
import { UserMenu } from "./user-menu";

type AppShellProps = {
  username: string;
  roleLabel: string;
  navItems: readonly AppNavItem[];
  children: ReactNode;
};

export function AppShell({ username, roleLabel, navItems, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      <aside className="border-b border-border bg-card md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="px-4 pt-4 text-lg font-semibold">EventFlow</div>
        <AppNav items={navItems} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-border bg-card px-4 py-3">
          <UserMenu username={username} roleLabel={roleLabel} />
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
