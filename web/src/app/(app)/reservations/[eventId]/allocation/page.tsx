import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db/client";
import { ForbiddenError } from "@/features/auth/errors";
import { can } from "@/features/auth/policy";
import { getEventOrThrow } from "@/features/events/service";
import { CasinoAllocation } from "@/features/seating/components/casino-allocation";
import { loadSeatingOverview, type SeatingOverview } from "@/features/seating/queries";

export const metadata: Metadata = { title: "Masa tahsisi | EventFlow" };

export default async function CasinoAllocationPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const loaded = await loadSeatingOverview(eventId);
  const { actor } = loaded;
  if (!can(actor, "reservations", "view")) throw new ForbiddenError();
  const event = await getEventOrThrow(db, eventId);
  // Aktör istemciye geçirilmez: yalnızca genel bakış alanları.
  const overview: SeatingOverview = {
    eventName: loaded.eventName,
    stage: loaded.stage,
    settings: loaded.settings,
    tables: loaded.tables,
    plan: loaded.plan,
  };
  const closed = event.status === "completed" || event.status === "cancelled";
  const canEdit = can(actor, "reservations", "edit") && !closed;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <Link
          href={`/reservations/${eventId}`}
          className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" />
          Rezervasyonlar
        </Link>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Masa tahsisi</h1>
        <p className="text-sm text-muted-foreground">{overview.eventName}</p>
        <p className="text-sm text-muted-foreground">
          Rezervasyon yapacağınız masaları ayırın. Ayırdığınız masalar online satışa kapanır; rezerve etmediklerinizi
          serbest bırakabilirsiniz.
        </p>
      </div>
      {closed ? (
        <p className="rounded-lg border border-border bg-card p-3 text-sm text-card-foreground">
          Tamamlanmış veya iptal edilmiş etkinlikte masa tahsisi değiştirilemez; yalnızca görüntüleyebilirsiniz.
        </p>
      ) : null}
      <CasinoAllocation eventId={eventId} initial={overview} canEdit={canEdit} />
    </div>
  );
}
