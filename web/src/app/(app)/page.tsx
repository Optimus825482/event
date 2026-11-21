import type { Metadata } from "next";
import Link from "next/link";
import { ROLE_LABELS } from "@/components/layout/role-labels";
import { visibleNavItems } from "@/features/auth/nav";
import { requirePolicyActor } from "@/features/auth/permissions";

export const metadata: Metadata = { title: "Ana sayfa | EventFlow" };

export default async function DashboardPage() {
  const actor = await requirePolicyActor();
  const items = visibleNavItems(actor);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Merhaba, {actor.username}</h1>
        <p className="text-sm text-muted-foreground">{ROLE_LABELS[actor.role]} olarak giriş yaptınız.</p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Erişebileceğiniz bir modül yok.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-(--radius) border border-border bg-card p-4 text-sm font-medium text-card-foreground shadow-sm transition-colors hover:bg-accent"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
