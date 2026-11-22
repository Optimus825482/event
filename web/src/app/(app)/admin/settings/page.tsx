import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { SettingsForm } from "@/features/settings/components/settings-form";
import { getSecurityOverview } from "@/features/settings/security-queries";
import { getSettings } from "@/features/settings/service";
import { currentSessionId } from "@/features/users/current-session";

export const metadata: Metadata = { title: "Ayarlar | EventFlow" };

export default async function SettingsPage() {
  const actor = await requirePolicyActor();
  if (!can(actor, "settings", "view")) notFound();
  const settings = await getSettings(db, actor);
  const security = actor.role === "admin" ? await getSecurityOverview(db, actor, await currentSessionId()) : null;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Sistem ayarları"
        description="Firma, e-posta ve bildirim ayarlarını yönetin"
        icon={
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            <Settings className="h-5 w-5" aria-hidden="true" />
          </div>
        }
      />
      {can(actor, "settings", "edit") ? (
        <SettingsForm settings={settings} security={security} />
      ) : (
        <p className="text-sm text-slate-400">Ayarları düzenleme yetkiniz yok.</p>
      )}
    </div>
  );
}
