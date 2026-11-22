import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { LogoForm } from "@/features/settings/components/logo-form";
import { SettingsForm } from "@/features/settings/components/settings-form";
import { getSettings } from "@/features/settings/service";

export const metadata: Metadata = { title: "Ayarlar | EventFlow" };

export default async function SettingsPage() {
  const actor = await requirePolicyActor();
  if (!can(actor, "settings", "view")) notFound();
  const settings = await getSettings(db, actor);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">Sistem ayarları</h1>
      {can(actor, "settings", "edit") ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Logo</CardTitle>
            </CardHeader>
            <CardContent>
              <LogoForm logo={settings.logo} />
            </CardContent>
          </Card>
          <SettingsForm settings={settings} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Ayarları düzenleme yetkiniz yok.</p>
      )}
    </div>
  );
}
