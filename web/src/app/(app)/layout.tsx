import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ROLE_LABELS } from "@/components/layout/role-labels";
import { buildShellNav } from "@/components/layout/shell-nav";
import { QueryProvider } from "@/components/providers/query-provider";
import { ToastProvider } from "@/components/ui/toast";
import { db } from "@/db/client";
import { UnauthenticatedError } from "@/features/auth/errors";
import { visibleNavGroups } from "@/features/auth/nav";
import { requirePolicyActor, type ActorWithPermissions } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { countUnread } from "@/features/notifications/service";

async function currentActorOrLogin(): Promise<ActorWithPermissions> {
  try {
    return await requirePolicyActor();
  } catch (error) {
    // redirect() try bloğunun içinde çağrılmaz: yönlendirme hatası yutulurdu.
    if (error instanceof UnauthenticatedError) redirect("/login");
    throw error;
  }
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const actor = await currentActorOrLogin();
  const nav = buildShellNav(actor.role, visibleNavGroups(actor));
  const showBell = can(actor, "notifications", "view");
  const unreadCount = showBell ? await countUnread(db, actor) : 0;

  return (
    <QueryProvider>
      <ToastProvider>
        <AppShell
          username={actor.username}
          roleLabel={ROLE_LABELS[actor.role]}
          isAdmin={actor.role === "admin"}
          nav={nav}
          unreadCount={unreadCount}
          showBell={showBell}
        >
          {children}
        </AppShell>
      </ToastProvider>
    </QueryProvider>
  );
}
