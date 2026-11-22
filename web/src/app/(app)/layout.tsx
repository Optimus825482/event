import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ROLE_LABELS } from "@/components/layout/role-labels";
import { QueryProvider } from "@/components/providers/query-provider";
import { UnauthenticatedError } from "@/features/auth/errors";
import { visibleNavItems } from "@/features/auth/nav";
import { requirePolicyActor, type ActorWithPermissions } from "@/features/auth/permissions";

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
  const navItems = visibleNavItems(actor).map(({ href, label }) => ({ href, label }));

  return (
    <QueryProvider>
      <AppShell username={actor.username} roleLabel={ROLE_LABELS[actor.role]} navItems={navItems}>
        {children}
      </AppShell>
    </QueryProvider>
  );
}
