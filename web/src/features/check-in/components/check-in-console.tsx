"use client";

import { useQuery } from "@tanstack/react-query";
import { History, ScanLine, Search, UserPlus } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { SettledEvent } from "../offline/queue-core";
import { realtimeKeys } from "@/features/realtime/keys";
import { useEventStream, type EventStreamStatus } from "@/features/realtime/use-event-stream";
import { eventStatsAction } from "../actions";
import { QueuePanel } from "../offline/queue-panel";
import { useOfflineQueue } from "../offline/use-offline-queue";
import { ServiceWorkerRegistrar } from "../offline/sw-register";
import { parseScannedCode } from "../scan-code";
import { CameraScanner } from "../scanner/camera-scanner";
import type { EventStats } from "../stats";
import { CheckInFeedbackBanner } from "./check-in-feedback";
import { ConsoleTabs, panelDomId, tabDomId, type ConsoleTabDef } from "./console-tabs";
import { GateSelect } from "./gate-select";
import { GuestSearch } from "./guest-search";
import { HistoryPanel } from "./history-panel";
import { ScanPanel } from "./scan-panel";
import { StatsPanel } from "./stats-panel";
import { useGate } from "./use-gate";
import { unwrap, useCheckIn } from "./use-check-in";
import { WalkInForm } from "./walk-in-form";

/** `readOnlyNote`: yazma kapalıysa nedeni (yetki yok ya da etkinlik kapalı); `null` ise not gösterilmez. */
type ConsoleProps = {
  eventId: string;
  /** Oturumdaki kullanıcı (sunucuda çözülür); çevrimdışı kuyruk öğeleri bununla damgalanır. */
  userId: string;
  initialStats: EventStats;
  canWrite: boolean;
  readOnlyNote: string | null;
};

const STREAM_LABEL: Record<EventStreamStatus, string> = {
  connecting: "Bağlanıyor…",
  open: "Canlı",
  reconnecting: "Bağlantı koptu, yeniden deneniyor…",
};

type TabId = "scan" | "search" | "history" | "walkin";

const TAB_PREFIX = "check-in";

const ALL_TABS: readonly ConsoleTabDef<TabId>[] = [
  { id: "scan", label: "Tarama", icon: ScanLine },
  { id: "search", label: "Ara", icon: Search },
  { id: "history", label: "Geçmiş", icon: History },
  { id: "walkin", label: "Walk-in", icon: UserPlus },
];

function ConsoleBody({ eventId, userId, initialStats, canWrite, readOnlyNote }: ConsoleProps) {
  const stream = useEventStream(eventId);
  const [syncNote, setSyncNote] = useState("");
  // Kuyruk olayları check-in kancasından gelir; kanca da kuyruğu ister: önce sabit bir yönlendirici.
  const handlers = useRef<(events: SettledEvent[]) => number>(() => 0);
  const queue = useOfflineQueue(
    userId,
    useCallback((events: SettledEvent[]) => {
      const synced = handlers.current(events);
      if (synced > 0) setSyncNote(`${synced} giriş sunucuya eşitlendi`);
    }, []),
  );
  const { gate, setGate } = useGate();
  const { submit, submitMany, pending, feedback, setFeedback, clear, onEvents } = useCheckIn(eventId, queue, gate);
  useEffect(() => {
    handlers.current = onEvents;
  }, [onEvents]);
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

  const [tab, setTab] = useState<TabId>("scan");
  // Yazma yetkisi yoksa tarama ve walk-in sekmeleri hiç gösterilmez.
  const tabs = canWrite ? ALL_TABS : ALL_TABS.filter((t) => t.id === "search" || t.id === "history");
  const active: TabId = tabs.some((t) => t.id === tab) ? tab : "search";

  // Paneller kalıcı olarak bağlı kalır (kamera akışı, form ve sorgu durumu sekme değişince kaybolmaz).
  const panel = (id: TabId, children: ReactNode) => (
    <div
      role="tabpanel"
      id={panelDomId(TAB_PREFIX, id)}
      aria-labelledby={tabDomId(TAB_PREFIX, id)}
      hidden={active !== id}
      className="space-y-4"
    >
      {children}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-xs text-slate-400" role="status" aria-live="polite">
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${stream === "open" ? "animate-pulse bg-emerald-500" : "bg-amber-500"}`}
          />
          {STREAM_LABEL[stream]}
        </p>
        <GateSelect gate={gate} onChange={setGate} />
      </div>
      <StatsPanel stats={stats.data} stale={stats.isFetching} />
      <div aria-live="assertive">
        <CheckInFeedbackBanner feedback={feedback} onClose={clear} />
      </div>
      <QueuePanel eventId={eventId} queue={queue} />
      <p className="sr-only" role="status" aria-live="polite">
        {syncNote}
      </p>
      {!canWrite && readOnlyNote ? (
        <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">{readOnlyNote}</p>
      ) : null}
      <ConsoleTabs tabs={tabs} active={active} onChange={setTab} prefix={TAB_PREFIX} label="Check-in bölümleri" />
      {canWrite
        ? panel(
            "scan",
            <>
              <ScanPanel onScan={onScan} pending={pending} />
              <CameraScanner onScan={onScan} disabled={pending} />
            </>,
          )
        : null}
      {panel(
        "search",
        <GuestSearch
          eventId={eventId}
          canWrite={canWrite}
          pending={pending}
          onCheckIn={(reservationId) => submit({ reservationId })}
          onCheckInTicket={(ticketId) => submit({ ticketId })}
          onCheckInTickets={(ids) => submitMany(ids.map((ticketId) => ({ ticketId })))}
        />,
      )}
      {panel("history", <HistoryPanel eventId={eventId} />)}
      {canWrite
        ? panel("walkin", <WalkInForm eventId={eventId} pending={pending} onSubmit={(walkIn) => submit({ walkIn })} />)
        : null}
    </div>
  );
}

/** Check-in ekranının istemci kökü (`QueryProvider` `(app)/layout.tsx` içinde). */
export function CheckInConsole(props: ConsoleProps) {
  return (
    <>
      <ServiceWorkerRegistrar />
      <ConsoleBody {...props} />
    </>
  );
}
