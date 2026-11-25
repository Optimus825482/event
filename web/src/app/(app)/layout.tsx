import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppOverlays } from "@/components/layout/app-overlays";
import { AppShell } from "@/components/layout/app-shell";
import { actorLabel } from "@/components/layout/role-labels";
import { buildShellNav } from "@/components/layout/shell-nav";
import { QueryProvider } from "@/components/providers/query-provider";
import { ToastProvider } from "@/components/ui/toast";
import { db } from "@/db/client";
import { UnauthenticatedError } from "@/features/auth/errors";
import { visibleNavGroups } from "@/features/auth/nav";
import { requirePolicyActor } from "@/features/auth/permissions";
import type { Actor } from "@/features/auth/session";
import { can } from "@/features/auth/policy";
import { countUnread } from "@/features/notifications/service";
import { currentSessionExpiry } from "@/features/users/current-session";
import { getOwnAvatar } from "@/features/users/profile";
import { isAdmin } from "@/features/auth/scope";

async function currentActorOrLogin(): Promise<Actor> {
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
  const nav = buildShellNav(visibleNavGroups(actor));
  const showBell = can(actor, "notifications", "view");
  const [unreadCount, avatarUrl, sessionExpiresAt] = await Promise.all([
    showBell ? countUnread(db, actor) : Promise.resolve(0),
    getOwnAvatar(db, actor),
    currentSessionExpiry(),
  ]);

  return (
    <QueryProvider>
      <ToastProvider>
        <AppShell
          username={actor.username}
          avatarUrl={avatarUrl}
          roleLabel={actorLabel(actor)}
          isAdmin={isAdmin(actor)}
          nav={nav}
          unreadCount={unreadCount}
          showBell={showBell}
        >
          {children}
        </AppShell>
        <AppOverlays sessionExpiresAt={sessionExpiresAt} />
      </ToastProvider>
    </QueryProvider>
  );
}
