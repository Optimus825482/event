"use client";

import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      refresh();
    } else {
      setMessage({
        ok: false,
        text: result.fieldErrors?.guestCount?.[0] ?? result.message,
      });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor={id} className="text-xs">
        Kişi (en çok {guest.tableCapacity})
      </Label>
      <Input
        id={id}
        type="number"
        min={1}
        max={guest.tableCapacity}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 w-20"
        aria-describedby={message ? `${id}-msg` : undefined}
      />
      <Button size="sm" variant="outline" onClick={save} disabled={saving || value === String(guest.guestCount)}>
        Kaydet
      </Button>
      {message ? (
        <span
          id={`${id}-msg`}
          role={message.ok ? "status" : "alert"}
          className={message.ok ? "text-xs text-emerald-600" : "text-xs text-destructive"}
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
        <Label htmlFor="guest-search">Misafir ara</Label>
        <Input
          id="guest-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ad, telefon ya da masa"
          autoComplete="off"
        />
      </div>

      {guests.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {guests.error.message}
        </p>
      ) : null}
      {guests.data && guests.data.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {query ? "Eşleşen misafir yok." : "Bu etkinlikte rezervasyon yok."}
        </p>
      ) : null}

      {guests.isPending ? <p className="text-sm text-muted-foreground">Yükleniyor…</p> : null}
      {guests.data && guests.data.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border" aria-busy={guests.isFetching}>
          {guests.data.map((guest) => (
            <li key={guest.reservationId} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0 space-y-1">
                <p className="font-medium">
                  {guest.guestName}
                  {guest.isBlacklisted ? (
                    <Badge variant="destructive" className="ml-2">
                      Kara liste
                    </Badge>
                  ) : null}
                </p>
                <p className="text-sm text-muted-foreground">
                  Masa {guest.tableLabel} · {guest.guestCount} kişi
                  {guest.phoneLast4 ? ` · •••${guest.phoneLast4}` : ""}
                </p>
                {canWrite && (guest.status === "checked_in" || CHECKABLE.has(guest.status)) ? (
                  <GuestCountEditor key={guest.guestCount} eventId={eventId} guest={guest} />
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={guest.status === "checked_in" ? "default" : "outline"}>
                  {RESERVATION_STATUS_LABELS[guest.status]}
                </Badge>
                {canWrite && CHECKABLE.has(guest.status) ? (
                  <Button onClick={() => onCheckIn(guest.reservationId)} disabled={pending}>
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
