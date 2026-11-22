import type { Metadata } from "next";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { OrganizationView } from "@/features/staff/components/organization-view";
import { getOrganizationCatalogs } from "@/features/staff/queries";

export const metadata: Metadata = { title: "Kuruluş ayarları | EventFlow" };

// Katalog yönetimi `staff` modülünün yetkisine bağlıdır (organizatör de düzenler);
// `settings` modülü yalnızca yöneticiye açıktır.
export default async function OrganizationSettingsPage() {
  const actor = await requirePolicyActor();
  if (!can(actor, "staff", "view")) {
    return <p className="text-sm text-muted-foreground">Bu sayfayı görüntüleme yetkiniz yok.</p>;
  }

  const catalogs = await getOrganizationCatalogs(db, actor);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Kuruluş ayarları</h1>
        <p className="text-sm text-muted-foreground">
          Bölüm, unvan, görev yeri, vardiya şablonları ve personel rolleri.
        </p>
      </div>
      <OrganizationView
        catalogs={catalogs}
        access={{
          canCreate: can(actor, "staff", "create"),
          canEdit: can(actor, "staff", "edit"),
          canDelete: can(actor, "staff", "delete"),
        }}
      />
    </div>
  );
}
