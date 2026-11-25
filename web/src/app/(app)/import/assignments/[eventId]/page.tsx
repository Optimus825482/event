import type { Metadata } from "next";
import Link from "next/link";
import { importAssignmentsAction, previewAssignmentImportAction } from "@/features/import/actions";
import { ImportPanel } from "@/features/import/components/import-panel";
import { loadImportPage } from "@/features/import/queries";

export const metadata: Metadata = { title: "Personel atamalarını Excel'den içe aktar | EventFlow" };

type Params = Promise<{ eventId: string }>;

export default async function AssignmentImportPage({ params }: { params: Params }) {
  const { eventId } = await params;
  const { event, tableCount } = await loadImportPage("staff", "edit", eventId);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-1">
        <Link href={`/events/${eventId}/team-organization`} className="text-sm text-muted-foreground hover:underline">
          {event.name}
        </Link>
        <h1 className="text-2xl font-semibold">Personel atamalarını Excel&apos;den içe aktar</h1>
        <p className="text-sm text-muted-foreground">
          Sütunlar: Sicil no veya Personel adı; Masa etiketleri veya Grup; Vardiya; Görev. Dosyadaki personelin masa
          atamaları dosyadakiyle değiştirilir, dosyada olmayan personele dokunulmaz. Etkinlikte {tableCount} masa var.
        </p>
      </div>
      <ImportPanel
        eventId={eventId}
        templateHref="/import/template/assignments"
        allOrNothing
        previewAction={previewAssignmentImportAction}
        importAction={importAssignmentsAction}
      />
    </div>
  );
}
