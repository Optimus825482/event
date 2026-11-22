import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { TeamOrganizationWizard } from "@/features/staffing/components/wizard";
import { loadTeamOrganization } from "@/features/staffing/queries";

export const metadata: Metadata = { title: "Ekip organizasyonu | EventFlow" };

export default async function TeamOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadTeamOrganization(id);
  const { event } = data.organization;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-1">
        <Link href={`/events/${event.id}`} className="text-sm text-muted-foreground hover:underline">
          {event.name}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Ekip organizasyonu</h1>
          {data.canImport ? (
            <Link href={`/import/assignments/${id}`} className={buttonVariants({ variant: "outline" })}>
              Excel&apos;den içe aktar
            </Link>
          ) : null}
        </div>
        {data.organization.editable ? null : (
          <p className="text-sm text-muted-foreground">
            Tamamlanmış veya iptal edilmiş etkinlik: organizasyon yalnızca görüntülenir.
          </p>
        )}
      </div>
      <TeamOrganizationWizard data={data} />
    </div>
  );
}
