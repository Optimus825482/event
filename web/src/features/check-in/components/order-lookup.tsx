"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { realtimeKeys } from "@/features/realtime/keys";
import { APP_TIME_ZONE } from "@/lib/time-zone";
import { findOrderAtDoorAction } from "../actions";
import { displayPnr, looksLikePnr } from "../door-code";
import { useOnline } from "../offline/use-offline-queue";
import { orderSummary, selectableTicketIds } from "./order-view";
import { unwrap } from "./use-check-in";

const timeFormat = new Intl.DateTimeFormat("tr-TR", {
  timeStyle: "short",
  timeZone: APP_TIME_ZONE,
});

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : timeFormat.format(d);
}

/** PNR yazılınca siparişin biletlerini listeler; seçilen biletler tek toplu gönderimle içeri alınır. */
export function OrderLookup({
  eventId,
  query,
  canWrite,
  pending,
  onCheckIn,
  onCheckInMany,
  guestsLoading = false,
  hasGuests = false,
  failedTicketIds = [],
}: {
  eventId: string;
  query: string;
  canWrite: boolean;
  pending: boolean;
  onCheckIn: (ticketId: string) => void;
  onCheckInMany: (ticketIds: string[]) => void;
  /** Misafir araması sürerken "sipariş bulunamadı" notu gösterilmez. */
  guestsLoading?: boolean;
  /** Aynı aramada misafir listesi doluysa "sipariş bulunamadı" notu gösterilmez. */
  hasGuests?: boolean;
  /** Kuyrukta reddedilmiş bu etkinlik biletleri: seçilemez, toplu gönderime girmez. */
  failedTicketIds?: readonly string[];
}) {
  const online = useOnline();
  const enabled = looksLikePnr(query);
  const order = useQuery({
    queryKey: [...realtimeKeys.checkIns(eventId), "order", query],
    queryFn: async () =>
      unwrap(await findOrderAtDoorAction({ eventId, pnr: query })),
    enabled: enabled && online,
  });
  // Kullanıcının işaretini kaldırdığı biletler; varsayılan hepsi seçili.
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(new Set());

  if (!enabled) return null;
  if (!online) {
    return (
      <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-300">
        PNR araması için bağlantı gerekir; bilet QR&apos;ı çevrimdışı da
        okutulabilir.
      </p>
    );
  }
  if (order.isError) {
    return (
      <p role="alert" className="text-sm text-red-400">
        {order.error.message}
      </p>
    );
  }
  if (order.isPending)
    return (
      <p role="status" className="text-sm text-slate-400">
        Sipariş aranıyor…
      </p>
    );
  if (!order.data) {
    return hasGuests || guestsLoading ? null : (
      <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-300">
        Bu PNR ile ödenmiş sipariş bulunamadı.
      </p>
    );
  }

  const data = order.data;
  const selectable = selectableTicketIds(data, failedTicketIds);
  const chosen = selectable.filter((id) => !unchecked.has(id));
  const toggle = (id: string) =>
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section
      aria-label="Sipariş"
      className="space-y-3 rounded-xl border border-slate-600 bg-slate-800 p-3"
    >
      <div>
        <h3 className="break-words font-medium text-white">{`Sipariş · PNR ${displayPnr(data.pnr)} · ${data.buyerName}`}</h3>
        <p className="text-sm text-slate-300">{orderSummary(data)}</p>
      </div>
      <ul className="space-y-2">
        {data.tickets.map((t, index) => {
          const rejected = failedTicketIds.includes(t.ticketId);
          const name = `Bilet ${index + 1} · Masa ${t.tableLabel}`;
          const boxId = `order-ticket-${t.ticketId}`;
          return (
            <li
              key={t.ticketId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700 p-2"
            >
              <div className="flex items-center gap-2">
                {t.checkedInAt === null && canWrite && !rejected ? (
                  <>
                    <input
                      id={boxId}
                      type="checkbox"
                      checked={!unchecked.has(t.ticketId)}
                      onChange={() => toggle(t.ticketId)}
                      aria-label={`${name} seç`}
                      className="h-6 w-6 accent-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                    />
                    <label
                      htmlFor={boxId}
                      aria-hidden="true"
                      className="text-sm text-white"
                    >
                      Masa {t.tableLabel}
                    </label>
                  </>
                ) : (
                  <span className="text-sm text-white">
                    Masa {t.tableLabel}
                  </span>
                )}
              </div>
              {t.checkedInAt !== null ? (
                <span className="text-sm text-emerald-300">
                  Giriş yaptı {formatTime(t.checkedInAt)}
                </span>
              ) : rejected ? (
                <span className="text-sm text-amber-300">
                  Reddedildi — Gönderilemeyen girişler&apos;e bakın
                </span>
              ) : canWrite ? (
                <Button
                  size="sm"
                  aria-label={`${name} için giriş yap`}
                  className="bg-emerald-600 text-white hover:bg-emerald-500"
                  onClick={() => onCheckIn(t.ticketId)}
                  disabled={pending}
                >
                  Giriş yap
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {canWrite && selectable.length > 0 ? (
        <Button
          className="bg-emerald-600 text-white hover:bg-emerald-500"
          onClick={() => onCheckInMany(chosen)}
          disabled={pending || chosen.length === 0}
        >
          {`Seçilenleri içeri al (${chosen.length})`}
        </Button>
      ) : null}
    </section>
  );
}
