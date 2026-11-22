import type { Metadata } from "next";
import Link from "next/link";
import { importReservationsAction, previewReservationImportAction } from "@/features/import/actions";
import { ImportPanel } from "@/features/import/components/import-panel";
import { loadImportPage } from "@/features/import/queries";

export const metadata: Metadata = { title: "Rezervasyonları Excel'den içe aktar | EventFlow" };

type Params = Promise<{ eventId: string }>;

export default async function ReservationImportPage({ params }: { params: Params }) {
  const { eventId } = await params;
  const { event, tableCount } = await loadImportPage("reservations", "create", eventId);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-1">
        <Link href={`/reservations/${eventId}`} className="text-sm text-muted-foreground hover:underline">
          {event.name}
        </Link>
        <h1 className="text-2xl font-semibold">Rezervasyonları Excel&apos;den içe aktar</h1>
        <p className="text-sm text-muted-foreground">
          Sütunlar: Masa etiketi, Misafir adı, Telefon, E-posta, Kişi sayısı, Not. Her satır elle girişle aynı kurallardan
          (müsaitlik, kapasite, kara liste) geçer; etkinlikte {tableCount} masa var.
        </p>
      </div>
      <ImportPanel
        eventId={eventId}
        templateHref="/import/template/reservations"
        allOrNothing={false}
        previewAction={previewReservationImportAction}
        importAction={importReservationsAction}
      />
    </div>
  );
}
