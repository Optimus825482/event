import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { OrganizationView } from "@/features/staff/components/organization-view";
import { getOrganizationCatalogs } from "@/features/staff/queries";

export const metadata: Metadata = { title: "Kuruluş ayarları | EventFlow" };

// Katalog yönetimi `staff` modülünün yetkisine bağlıdır (F&B departmanı da düzenler);
// `settings` modülü yalnızca yöneticiye açıktır.
export default async function OrganizationSettingsPage() {
  const actor = await requirePolicyActor();
  if (!can(actor, "staff", "view")) {
    return <p className="text-sm text-slate-400">Bu sayfayı görüntüleme yetkiniz yok.</p>;
  }

  const catalogs = await getOrganizationCatalogs(db, actor);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Kuruluş ayarları"
        description="Bölüm, unvan, görev yeri, vardiya şablonları ve personel rolleri."
        icon={<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400"><Building2 className="h-5 w-5" aria-hidden="true" /></div>}
        className="mb-0"
      />
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
