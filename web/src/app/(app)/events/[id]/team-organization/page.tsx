import { ArrowLeft, FileSpreadsheet, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { TeamOrganizationWizard } from "@/features/staffing/components/wizard";
import { loadTeamOrganization } from "@/features/staffing/queries";

export const metadata: Metadata = { title: "Ekip organizasyonu | EventFlow" };

export default async function TeamOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadTeamOrganization(id);
  const { event } = data.organization;

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href={`/events/${event.id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {event.name}
      </Link>
      <PageHeader
        title="Ekip organizasyonu"
        description="Masaları gruplara ayırın, ekipleri kurun ve personeli atayın."
        icon={
          <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
            <Users aria-hidden className="size-5" />
          </div>
        }
        actions={
          data.canImport ? (
            <Link href={`/import/assignments/${id}`} className={buttonVariants({ variant: "outline" })}>
              <FileSpreadsheet aria-hidden className="size-4" />
              Excel&apos;den içe aktar
            </Link>
          ) : null
        }
      />
      {data.organization.editable ? null : (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
          Tamamlanmış veya iptal edilmiş etkinlik: organizasyon yalnızca görüntülenir.
        </p>
      )}
      <TeamOrganizationWizard data={data} />
    </div>
  );
}
