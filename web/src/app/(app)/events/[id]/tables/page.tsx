import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/ui/PageContainer";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { authorize, can } from "@/features/auth/policy";
import { EventSectionNav } from "@/features/events/components/event-section-nav";
import { getEventOrThrow } from "@/features/events/service";
import { visibleEventSections } from "@/features/events/sections";
import { SeatingConsole } from "@/features/seating/components/seating-console";
import { loadSeatingOverview, type SeatingOverview } from "@/features/seating/queries";
import { isUuid } from "@/lib/identifiers";

export const metadata: Metadata = { title: "Masalar ve Satış | EventFlow" };

export default async function EventTablesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePolicyActor();
  authorize(actor, "ticketing", "view");
  if (!isUuid(id)) notFound();
  // Önce genel bakış: olmayan etkinlikte `notFound()` (404) verir; durum sorgusu bundan sonra çalışır.
  const loaded = await loadSeatingOverview(id);
  const event = await getEventOrThrow(db, id);
  // Aktör istemciye geçirilmez: yalnızca genel bakış alanları.
  const overview: SeatingOverview = {
    eventName: loaded.eventName,
    stage: loaded.stage,
    settings: loaded.settings,
    tables: loaded.tables,
    plan: loaded.plan,
  };
  const closed = event.status === "completed" || event.status === "cancelled";
  const canEdit = can(actor, "ticketing", "edit") && !closed;

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="space-y-2">
          <Link href={`/events/${id}`} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
            Etkinlik
          </Link>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Masalar ve Satış</h1>
          <p className="text-sm text-muted-foreground">{overview.eventName}</p>
        </div>
        <EventSectionNav eventId={id} sections={visibleEventSections(actor)} active="tables" />
        {closed ? (
          <p className="rounded-lg border border-border bg-card p-3 text-sm text-card-foreground">
            Tamamlanmış veya iptal edilmiş etkinlikte masa ve satış ayarları değiştirilemez; yalnızca görüntüleyebilirsiniz.
          </p>
        ) : null}
        <SeatingConsole eventId={id} initial={overview} canEdit={canEdit} />
      </div>
    </PageContainer>
  );
}
