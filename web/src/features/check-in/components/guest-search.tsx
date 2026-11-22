"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPin, Search, UserCheck } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { realtimeKeys } from "@/features/realtime/keys";
import { RESERVATION_STATUS_LABELS } from "@/features/reservations/labels";
import { searchGuestsAction, updateGuestCountAction } from "../actions";
import type { GuestRow } from "../read-service";
import { unwrap, useRefreshEvent } from "./use-check-in";

const CHECKABLE = new Set(["pending", "confirmed", "no_show"]);

function GuestCountEditor({ eventId, guest }: { eventId: string; guest: GuestRow }) {
  const [value, setValue] = useState(String(guest.guestCount));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const refresh = useRefreshEvent(eventId);
  const toast = useToast();
  const id = `guest-count-${guest.reservationId}`;

  async function save() {
    setSaving(true);
    const result = await updateGuestCountAction({
      eventId,
      reservationId: guest.reservationId,
      guestCount: value,
    });
    setSaving(false);
    if (result.ok) {
      setMessage({ ok: true, text: "Kaydedildi" });
      toast.success("Kişi sayısı güncellendi");
      refresh();
    } else {
      const text = result.fieldErrors?.guestCount?.[0] ?? result.message;
      setMessage({ ok: false, text });
      toast.error(text);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor={id} className="text-xs text-slate-400">
        Kişi (en çok {guest.tableCapacity})
      </Label>
      <Input
        id={id}
        type="number"
        min={1}
        max={guest.tableCapacity}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 w-20 border-slate-600 bg-slate-900 text-white"
        aria-describedby={message ? `${id}-msg` : undefined}
      />
      <Button
        size="sm"
        variant="outline"
        className="border-slate-600 bg-transparent text-slate-200 hover:bg-slate-700"
        onClick={save}
        disabled={saving || value === String(guest.guestCount)}
      >
        Kaydet
      </Button>
      {message ? (
        <span
          id={`${id}-msg`}
          role={message.ok ? "status" : "alert"}
          className={message.ok ? "text-xs text-emerald-400" : "text-xs text-red-400"}
        >
          {message.text}
        </span>
      ) : null}
    </div>
  );
}

/** Manuel arama (ad, telefon, masa) ve listeden giriş; liste canlı olaylarla yenilenir. */
export function GuestSearch({
  eventId,
  canWrite,
  pending,
  onCheckIn,
}: {
  eventId: string;
  canWrite: boolean;
  pending: boolean;
  onCheckIn: (reservationId: string) => void;
}) {
  const [q, setQ] = useState("");
  const query = useDeferredValue(q.trim());
  const guests = useQuery({
    queryKey: [...realtimeKeys.reservations(eventId), "check-in-search", query],
    queryFn: async () => unwrap(await searchGuestsAction({ eventId, q: query })),
    placeholderData: (previous) => previous,
  });

  return (
    <section aria-label="Misafir ara" className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="guest-search" className="text-slate-200">
          Misafir ara
        </Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />
          <Input
            id="guest-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ad, telefon ya da masa"
            autoComplete="off"
            className="h-11 border-slate-600 bg-slate-800 pl-9 text-white placeholder:text-slate-500"
          />
        </div>
      </div>

      {guests.isError ? (
        <p role="alert" className="text-sm text-red-400">
          {guests.error.message}
        </p>
      ) : null}
      {guests.data && guests.data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
          {query ? "Eşleşen misafir yok." : "Bu etkinlikte rezervasyon yok."}
        </p>
      ) : null}

      {guests.isPending ? <p className="text-sm text-slate-400">Yükleniyor…</p> : null}
      {guests.data && guests.data.length > 0 ? (
        <ul className="space-y-2" aria-busy={guests.isFetching}>
          {guests.data.map((guest) => (
            <li
              key={guest.reservationId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-800 p-3"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-white">
                  {guest.guestName}
                  {guest.isBlacklisted ? (
                    <Badge variant="destructive" className="ml-2">
                      Kara liste
                    </Badge>
                  ) : null}
                </p>
                <p className="text-sm text-slate-400">
                  Masa {guest.tableLabel} · {guest.guestCount} kişi
                  {guest.phoneLast4 ? ` · •••${guest.phoneLast4}` : ""}
                </p>
                <Link
                  href={`/check-in/${eventId}/plan?masa=${encodeURIComponent(guest.tableId)}`}
                  className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                  aria-label={`${guest.guestName} masasını planda göster`}
                >
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  Masayı planda göster
                </Link>
                {canWrite && (guest.status === "checked_in" || CHECKABLE.has(guest.status)) ? (
                  <GuestCountEditor key={guest.guestCount} eventId={eventId} guest={guest} />
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    guest.status === "checked_in"
                      ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                      : "border-slate-600 text-slate-300"
                  }
                >
                  {guest.status === "checked_in" ? <UserCheck aria-hidden="true" /> : null}
                  {RESERVATION_STATUS_LABELS[guest.status]}
                </Badge>
                {canWrite && CHECKABLE.has(guest.status) ? (
                  <Button
                    className="bg-emerald-600 text-white hover:bg-emerald-500"
                    onClick={() => onCheckIn(guest.reservationId)}
                    disabled={pending}
                  >
                    Giriş yap
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
