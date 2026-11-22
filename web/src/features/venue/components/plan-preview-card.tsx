import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { FloorPlanData } from "../plan-types";
import { FloorPlanView } from "./floor-plan-view";

type Props = { eventId: string; plan: FloorPlanData; canEdit: boolean };

/** Etkinlik detayında küçük, etkileşimsiz yerleşim önizlemesi ve düzenleyiciye bağlantı. */
export function PlanPreviewCard({ eventId, plan, canEdit }: Props) {
  const empty = plan.tables.length === 0;
  const tables = plan.tables.filter((t) => !t.isLoca).length;
  const locas = plan.tables.length - tables;
  return (
    <section aria-labelledby="plan-preview-title" className="space-y-3 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="plan-preview-title" className="text-lg font-medium">
            Yerleşim planı
          </h2>
          <p className="text-sm text-muted-foreground">
            {empty ? "Henüz masa yerleştirilmedi." : `${tables} masa${locas > 0 ? ` · ${locas} loca` : ""}`}
          </p>
        </div>
        <Link href={`/events/${eventId}/venue`} className={buttonVariants({ variant: empty ? "default" : "outline", size: "sm" })}>
          {empty ? (canEdit ? "Yerleşim planı oluştur" : "Yerleşim planını aç") : canEdit ? "Düzenle" : "Planı aç"}
        </Link>
      </div>
      {empty ? null : <FloorPlanView plan={plan} compact ariaLabel="Yerleşim planı önizlemesi" />}
    </section>
  );
}
