"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { QueryProvider } from "@/components/providers/query-provider";
import { realtimeKeys } from "@/features/realtime/keys";
import { useEventStream, type EventStreamStatus } from "@/features/realtime/use-event-stream";
import { eventStatsAction, recentCheckInsAction } from "../actions";
import { parseScannedCode } from "../scan-code";
import type { EventStats } from "../stats";
import { CheckInFeedbackBanner } from "./check-in-feedback";
import { GuestSearch } from "./guest-search";
import { ScanPanel } from "./scan-panel";
import { StatsPanel } from "./stats-panel";
import { unwrap, useCheckIn } from "./use-check-in";
import { WalkInForm } from "./walk-in-form";

/** `readOnlyNote`: yazma kapalıysa nedeni (yetki yok ya da etkinlik kapalı); `null` ise not gösterilmez. */
type ConsoleProps = {
  eventId: string;
  initialStats: EventStats;
  canWrite: boolean;
  readOnlyNote: string | null;
};

const STREAM_LABEL: Record<EventStreamStatus, string> = {
  connecting: "Bağlanıyor…",
  open: "Canlı",
  reconnecting: "Bağlantı koptu, yeniden deneniyor…",
};

const timeFormat = new Intl.DateTimeFormat("tr-TR", {
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

function RecentCheckIns({ eventId }: { eventId: string }) {
  const recent = useQuery({
    queryKey: [...realtimeKeys.checkIns(eventId), "recent"],
    queryFn: async () => unwrap(await recentCheckInsAction({ eventId })),
  });
  if (!recent.data || recent.data.length === 0) {
    return <p className="text-sm text-muted-foreground">Henüz giriş yapan yok.</p>;
  }
  return (
    <ul className="space-y-1 text-sm">
      {recent.data.map((r) => (
        <li key={r.reservationId} className="flex justify-between gap-2">
          <span>
            {r.guestName} · Masa {r.tableLabel} · {r.guestCount} kişi
          </span>
          <span className="tabular-nums text-muted-foreground">
            {r.checkedInAt ? timeFormat.format(new Date(r.checkedInAt)) : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ConsoleBody({ eventId, initialStats, canWrite, readOnlyNote }: ConsoleProps) {
  const stream = useEventStream(eventId);
  const { submit, pending, feedback, setFeedback, clear } = useCheckIn(eventId);
  const stats = useQuery({
    queryKey: realtimeKeys.stats(eventId),
    queryFn: async () => unwrap(await eventStatsAction({ eventId })),
    initialData: initialStats,
  });

  /** Tek giriş noktası: el okuyucu, yapıştırma ve (Task 18) kamera okuyucusu bunu çağırır. */
  const onScan = useCallback(
    (token: string) => {
      const code = parseScannedCode(token);
      if (!code) {
        setFeedback({
          kind: "error",
          code: "invalid",
          message: "QR kod okunamadı",
        });
        return;
      }
      submit(code);
    },
    [setFeedback, submit],
  );

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
        {STREAM_LABEL[stream]}
      </p>
      <StatsPanel stats={stats.data} stale={stats.isFetching} />
      <div aria-live="assertive">
        <CheckInFeedbackBanner feedback={feedback} onClose={clear} />
      </div>
      {canWrite ? <ScanPanel onScan={onScan} pending={pending} /> : null}
      {!canWrite && readOnlyNote ? (
        <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          {readOnlyNote}
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <GuestSearch
          eventId={eventId}
          canWrite={canWrite}
          pending={pending}
          onCheckIn={(reservationId) => submit({ reservationId })}
        />
        <div className="space-y-6">
          {canWrite ? <WalkInForm eventId={eventId} onDone={setFeedback} /> : null}
          <section aria-label="Son girişler" className="space-y-2">
            <h2 className="text-lg font-semibold">Son girişler</h2>
            <RecentCheckIns eventId={eventId} />
          </section>
        </div>
      </div>
    </div>
  );
}

/**
 * Check-in ekranının istemci kökü. Uygulama düzeninde `QueryProvider` henüz bağlı olmadığı için
 * burada yerel olarak sarılır (düzen bağlandığında bu sarmalayıcı kaldırılabilir).
 */
export function CheckInConsole(props: ConsoleProps) {
  return (
    <QueryProvider>
      <ConsoleBody {...props} />
    </QueryProvider>
  );
}
