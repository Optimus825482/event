"use client";

import { useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { DEFAULT_PARTY_SIZE, PARTY_PARAM } from "@/features/plan/party";
import { salonPath } from "./ticket-dialog-shared";
import { cn } from "@/lib/cn";

const PRESET_COUNTS = [1, 2, 3, 4, 5, 6, 8, 12] as const;

export function InlineGuestPicker({
  eventId,
  maxSeatsPerOrder,
  minPriceLabel,
}: {
  eventId: string;
  maxSeatsPerOrder: number;
  minPriceLabel: string | null;
}): React.JSX.Element {
  const options = PRESET_COUNTS.filter((n) => n <= maxSeatsPerOrder);
  const choices = options.length > 0 ? options : [1];
  const initial = choices.includes(DEFAULT_PARTY_SIZE) ? DEFAULT_PARTY_SIZE : (choices[0] ?? 1);
  const [guests, setGuests] = useState<number>(initial);

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-3 text-[13px] font-semibold text-muted">Kaç Kişilik Bilet Alacaksınız?</p>
        <div role="group" aria-label="Kişi sayısı" className="flex flex-wrap gap-2">
          {choices.map((n) => {
            const active = guests === n;
            return (
              <button
                key={n}
                type="button"
                aria-pressed={active}
                onClick={() => setGuests(n)}
                className={cn(
                  "min-h-10 min-w-11 cursor-pointer rounded-[10px] border px-4 py-2 text-sm font-bold transition-colors",
                  active
                    ? "border-gold bg-gold text-on-gold"
                    : "border-line bg-surface-raised text-ivory hover:border-gold",
                )}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <ButtonLink href={`${salonPath(eventId)}?${PARTY_PARAM}=${guests}`} variant="gold" size="lg">
          Masa Seçimine Geç →
        </ButtonLink>
        {minPriceLabel ? (
          <p className="text-sm text-muted">
            Başlangıç: <strong className="text-lg font-bold text-gold-bright">{minPriceLabel}</strong>
          </p>
        ) : null}
      </div>
    </div>
  );
}
