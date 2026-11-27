"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { DEFAULT_PARTY_SIZE, PARTY_PARAM } from "@/features/plan/party";
import { partyOptions } from "./facts";

/** Pencerenin kimliği; `#bilet-al` bağlantıları (kartlar, üst menü) bu pencereyi açar. */
export const TICKET_DIALOG_ID = "bilet-al";
export const TICKET_DIALOG_HASH = `#${TICKET_DIALOG_ID}`;
const OPEN_EVENT = "bilet-al:ac";

/** Sayfada "Bilet Al" penceresi varsa açar ve `true` döner (üst menü düğmesi için). */
export function openTicketDialog(): boolean {
  if (typeof document === "undefined" || !document.getElementById(TICKET_DIALOG_ID)) return false;
  window.dispatchEvent(new Event(OPEN_EVENT));
  return true;
}

/**
 * JS kapalıyken pencere `:target` ile görünür olur (`#bilet-al` bağlantısı); form GET ile gönderilir.
 * Yalnızca `<noscript>` içinde yüklenir.
 */
export const TICKET_DIALOG_NOSCRIPT_CSS = `<style>dialog#${TICKET_DIALOG_ID}:target{display:block;position:fixed;inset:0;z-index:60;height:fit-content}</style>`;

export type TicketDialogProps = {
  eventId: string;
  /** `"LEVENT YÜKSEL · 12 ARALIK 2026"` */
  eyebrow: string;
  maxSeatsPerOrder: number;
  selected?: number;
};

/** Etkinlik sayfasındaki "Bilet Al" düğmesi ve kişi sayısı penceresi. */
export function TicketDialog({ eventId, eyebrow, maxSeatsPerOrder, selected }: TicketDialogProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const selectId = useId();
  const noteId = useId();
  const options = partyOptions(maxSeatsPerOrder);
  const maxOption = options[options.length - 1] ?? 1;
  const chosen = Math.max(1, Math.min(selected ?? DEFAULT_PARTY_SIZE, maxOption));

  const selectRef = useRef<HTMLSelectElement>(null);
  const show = useCallback(() => setOpen(true), []);

  // Pencere açılınca (Modal showModal'ı önce çağırır) odak kişi sayısı seçimine gelir.
  useEffect(() => {
    if (open) selectRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const fromHash = () => {
      if (window.location.hash === TICKET_DIALOG_HASH) show();
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    window.addEventListener(OPEN_EVENT, show);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      window.removeEventListener(OPEN_EVENT, show);
    };
  }, [show]);

  return (
    <>
      <a
        href={TICKET_DIALOG_HASH}
        aria-haspopup="dialog"
        onClick={(e) => {
          e.preventDefault();
          show();
        }}
        className="inline-flex min-h-12 min-w-11 items-center justify-center rounded-full bg-gold px-8 py-3 text-lg font-bold text-on-gold no-underline transition-colors hover:bg-gold-bright"
      >
        Bilet Al
      </a>
      <Modal
        id={TICKET_DIALOG_ID}
        open={open}
        onClose={() => setOpen(false)}
        labelledBy={titleId}
        keepMounted
        className="max-w-[440px]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 pb-4 pt-6">
          <div className="min-w-0 space-y-1.5">
            <p className="text-[11.5px] font-bold tracking-[0.2em] text-gold">{eyebrow}</p>
            <h2 id={titleId} className="text-[28px] leading-tight text-ivory">
              Kişi sayısı
            </h2>
          </div>
          <button
            type="button"
            aria-label="Pencereyi kapat"
            onClick={() => setOpen(false)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line text-xl text-muted transition-colors hover:border-gold hover:text-ivory"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
          <form method="get" action={`/etkinlik/${eventId}#masa-secimi`} className="flex flex-col gap-3 px-6 py-6">
            <label htmlFor={selectId} className="text-sm font-semibold text-ivory">
              Kişi sayısı
            </label>
            <select
              key={chosen}
              id={selectId}
              name={PARTY_PARAM}
              defaultValue={chosen}
              ref={selectRef}
              aria-describedby={noteId}
              className="min-h-12 rounded-[12px] border border-line-gold bg-bg px-4 text-base text-ivory focus-visible:outline-2 focus-visible:outline-gold-bright"
            >
              {options.map((n) => (
                <option key={n} value={n}>
                  {`${n} kişi`}
                </option>
              ))}
            </select>
            <p id={noteId} className="text-sm text-muted">
              Kişi sayısına uygun masalar gösterilir. Müsait localar bütün olarak rezerve edilir.
            </p>
            <Button type="submit" variant="gold" size="lg" className="mt-2 w-full">
              Masa seçimine geç →
            </Button>
          </form>
      </Modal>
    </>
  );
}
