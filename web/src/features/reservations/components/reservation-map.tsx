"use client";

import Link from "next/link";
import { useState } from "react";
import { FloorPlanView } from "@/features/venue/components/floor-plan-view";
import { PLAN_STATUS_LABELS } from "@/features/venue/plan-status";
import { RESERVATION_STATUS_LABELS } from "../labels";
import type { ReservationPlan } from "../plan-service";

/** Etkinliğin durum renkli haritası; masaya tıklayınca o masanın rezervasyonları listelenir. */
export function ReservationMap({ eventId, data }: { eventId: string; data: ReservationPlan }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const table = data.plan.tables.find((t) => t.id === selectedId);
  const rows = data.reservations.filter((r) => r.tableId === selectedId);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <FloorPlanView
        plan={data.plan}
        statuses={data.statuses}
        selectedId={selectedId}
        onSelect={setSelectedId}
        height={520}
        ariaLabel="Rezervasyon haritası"
      />
      <aside aria-live="polite" className="space-y-3 rounded-lg border border-border p-4 text-sm">
        {table ? (
          <>
            <div>
              <h2 className="text-base font-semibold">{table.label}</h2>
              <p className="text-muted-foreground">
                {table.capacity} kişilik{table.isLoca ? " · loca" : ""} · {PLAN_STATUS_LABELS[data.statuses[table.id] ?? "free"]}
              </p>
            </div>
            {rows.length === 0 ? (
              <p className="text-muted-foreground">Bu masada rezervasyon yok.</p>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((r) => (
                  <li key={r.id} className="space-y-0.5 py-2">
                    <Link href={`/reservations/${eventId}/${r.id}`} className="font-medium hover:underline">
                      {r.guestName ?? r.customerName ?? "Misafir"}
                    </Link>
                    <p className="text-muted-foreground">
                      {r.guestCount} kişi · {RESERVATION_STATUS_LABELS[r.status]}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">Rezervasyonlarını görmek için haritada bir masaya tıklayın.</p>
        )}
      </aside>
    </div>
  );
}
