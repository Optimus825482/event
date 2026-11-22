"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { sendInvitationEmailAction, whatsappLinkAction } from "../actions";
import type { Recipient } from "../event-invitation";

type RowState = { ok: boolean; message: string; whatsapp?: string } | undefined;

const STATUS_LABELS: Record<string, string> = {
  pending: "Beklemede",
  confirmed: "Onaylı",
  checked_in: "Giriş yaptı",
};

export function SendPanel({ recipients, canSend }: { recipients: Recipient[]; canSend: boolean }) {
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [busy, setBusy] = useState<string | null>(null);

  function setRow(id: string, state: RowState) {
    setRows((current) => ({ ...current, [id]: state }));
  }

  async function email(id: string) {
    setBusy(id);
    const res = await sendInvitationEmailAction({ reservationId: id });
    setBusy(null);
    setRow(id, res.ok ? { ok: true, message: "E-posta gönderildi" } : { ok: false, message: res.message });
  }

  async function whatsapp(id: string) {
    setBusy(id);
    const res = await whatsappLinkAction({ reservationId: id });
    setBusy(null);
    if (!res.ok) return setRow(id, { ok: false, message: res.message });
    setRow(id, {
      ok: true,
      message: res.data.hasPhone ? "Bağlantı hazır" : "Telefon kayıtlı değil; WhatsApp'ta kişiyi kendiniz seçeceksiniz",
      whatsapp: res.data.url,
    });
  }

  if (recipients.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Bu etkinlikte davetiye gönderilecek rezervasyon yok.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {recipients.map((r) => {
        const state = rows[r.reservationId];
        const disabled = !canSend || busy === r.reservationId;
        return (
          <li key={r.reservationId} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.guestName}</p>
              <p className="text-xs text-muted-foreground">
                Masa {r.tableLabel} - {STATUS_LABELS[r.status] ?? r.status}
              </p>
              {state ? (
                <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-xs text-emerald-600" : "text-xs text-destructive"}>
                  {state.message}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled || !r.hasEmail}
                title={r.hasEmail ? undefined : "E-posta adresi kayıtlı değil"}
                onClick={() => void email(r.reservationId)}
              >
                E-posta gönder
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => void whatsapp(r.reservationId)}>
                WhatsApp bağlantısı
              </Button>
              {state?.whatsapp ? (
                <a href={state.whatsapp} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline-offset-4 hover:underline">
                  WhatsApp&apos;ta aç
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
