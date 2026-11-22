import type { Metadata } from "next";
import Link from "next/link";
import { EVENT_STATUS_LABELS } from "@/features/events/labels";
import { VenueEditor } from "@/features/venue/components/venue-editor";
import { loadVenueEditor } from "@/features/venue/queries";

export const metadata: Metadata = { title: "Masa yerleşimi | EventFlow" };

export default async function EventVenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadVenueEditor(id);
  const { layout } = data;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="space-y-1">
          <Link href={`/events/${layout.event.id}`} className="text-sm text-muted-foreground hover:underline">
            {layout.event.name}
          </Link>
          <h1 className="text-2xl font-semibold">Masa yerleşimi</h1>
        </div>
        <span className="rounded-full border border-border px-3 py-1 text-sm">
          {EVENT_STATUS_LABELS[layout.event.status]}
        </span>
      </div>
      {!layout.editable ? (
        <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">
          Tamamlanmış veya iptal edilmiş etkinliğin yerleşimi değiştirilemez; yalnızca görüntüleyebilirsiniz.
        </p>
      ) : null}
      <VenueEditor
        eventId={layout.event.id}
        initial={{
          tables: layout.tables.map((t) => ({
            id: t.id,
            label: t.label,
            capacity: t.capacity,
            tableTypeId: t.tableTypeId,
            x: t.x,
            y: t.y,
            rotation: t.rotation,
            isLoca: t.isLoca,
            isVip: t.isVip,
            isPinned: t.isPinned,
            size: t.size,
            floor: t.floor,
            sortNumber: t.sortNumber,
          })),
          decor: layout.decor,
          lockedTableIds: layout.lockedTableIds,
        }}
        tableTypes={data.tableTypes}
        templates={data.templates}
        canEdit={data.canEdit}
        canSaveTemplate={data.canSaveTemplate}
      />
    </div>
  );
}
