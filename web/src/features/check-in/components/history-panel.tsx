"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, History, MapPin } from "lucide-react";
import Link from "next/link";
import { realtimeKeys } from "@/features/realtime/keys";
import { recentCheckInsAction } from "../actions";
import { unwrap } from "./use-check-in";

const timeFormat = new Intl.DateTimeFormat("tr-TR", {
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

/** Geçmiş sekmesi: son girişler (en yeni önce); canlı olaylarla yenilenir. */
export function HistoryPanel({ eventId }: { eventId: string }) {
  const recent = useQuery({
    queryKey: [...realtimeKeys.checkIns(eventId), "recent"],
    queryFn: async () => unwrap(await recentCheckInsAction({ eventId })),
  });
  const empty = !recent.data || recent.data.length === 0;
  return (
    <section aria-label="Son girişler" className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
        <History className="h-5 w-5 text-emerald-400" aria-hidden="true" />
        Son girişler
      </h2>
      {empty ? (
        <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
          Henüz giriş yapan yok.
        </p>
      ) : (
        <ul className="divide-y divide-slate-700 rounded-xl border border-slate-700 bg-slate-800">
          {recent.data.map((r) => (
            <li key={r.reservationId} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 truncate text-slate-200">
                  {r.guestName} · Masa {r.tableLabel} · {r.guestCount} kişi
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Link
                  href={`/check-in/${eventId}/plan?masa=${encodeURIComponent(r.tableLabel)}`}
                  className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                  aria-label={`${r.guestName} masasını planda göster`}
                >
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  Plan
                </Link>
                <span className="tabular-nums text-slate-400">
                  {r.checkedInAt ? timeFormat.format(new Date(r.checkedInAt)) : ""}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
