"use client";

import { useState } from "react";
import { EventImage } from "@/components/event-image";
import { PosterFallback } from "@/components/poster-fallback";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { saleStateLabel } from "@/features/plan/sale-state";
import { cn } from "@/lib/cn";
import type { EventCard as EventCardData } from "@/lib/core/contract";
import { formatMoney } from "@/lib/format";
import { imageUrl } from "@/lib/image-url";
import { APP_TIME_ZONE, formatEventDate, formatEventTime } from "@/lib/time-zone";

const MONTH_OPTIONS = [
  { value: "all", label: "Tüm Aylar" },
  { value: "Ocak", label: "Ocak" },
  { value: "Şubat", label: "Şubat" },
  { value: "Mart", label: "Mart" },
  { value: "Nisan", label: "Nisan" },
  { value: "Mayıs", label: "Mayıs" },
  { value: "Haziran", label: "Haziran" },
  { value: "Temmuz", label: "Temmuz" },
  { value: "Ağustos", label: "Ağustos" },
  { value: "Eylül", label: "Eylül" },
  { value: "Ekim", label: "Ekim" },
  { value: "Kasım", label: "Kasım" },
  { value: "Aralık", label: "Aralık" },
] as const;

function monthNameTr(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", { month: "long", timeZone: APP_TIME_ZONE }).format(new Date(iso));
}

export function CalendarGrid({ events }: { events: EventCardData[] }): React.JSX.Element {
  const [query, setQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "open">("all");

  const normalized = query.trim().toLocaleLowerCase("tr-TR");
  const filtered = events.filter((event) => {
    if (statusFilter === "open" && event.saleState !== "open") return false;
    if (monthFilter !== "all" && monthNameTr(event.startsAt).toLocaleLowerCase("tr-TR") !== monthFilter.toLocaleLowerCase("tr-TR")) {
      return false;
    }
    if (!normalized) return true;
    return (
      event.name.toLocaleLowerCase("tr-TR").includes(normalized) ||
      (event.artistName ?? "").toLocaleLowerCase("tr-TR").includes(normalized)
    );
  });

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap gap-2.5">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sanatçı ara..."
          aria-label="Sanatçı ara"
          className="min-w-[min(100%,210px)] flex-1 rounded-[12px] border border-line bg-surface px-3.5 py-2.5 text-[13.5px] text-ivory placeholder:text-muted focus:border-gold focus:outline-none"
        />
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          aria-label="Ay filtresi"
          className="min-w-[140px] flex-1 rounded-[12px] border border-line bg-surface px-3.5 py-2.5 text-[13.5px] text-ivory focus:border-gold focus:outline-none sm:flex-none"
        >
          {MONTH_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | "open")}
          aria-label="Satış durumu filtresi"
          className="min-w-[140px] flex-1 rounded-[12px] border border-line bg-surface px-3.5 py-2.5 text-[13.5px] text-ivory focus:border-gold focus:outline-none sm:flex-none"
        >
          <option value="all">Tüm Etkinlikler</option>
          <option value="open">Satışta</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <Notice>Seçili filtrelere uygun etkinlik bulunamadı.</Notice>
      ) : (
        <div className="card-grid">
          {filtered.map((event) => {
            const open = event.saleState === "open";
            const src = imageUrl(event.coverImage ?? event.artistImage);
            const dateLabel = formatEventDate(event.startsAt);
            const timeLabel = formatEventTime(event.startsAt);

            return (
              <article
                key={event.id}
                className="group flex flex-col overflow-hidden rounded-[16px] border border-line bg-surface transition-all hover:-translate-y-0.5 hover:border-gold"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface-raised">
                  <EventImage
                    src={src}
                    alt={event.artistName ?? event.name}
                    className="h-full w-full object-cover object-[center_20%] transition-transform duration-300 group-hover:scale-[1.03]"
                    fallback={
                      <PosterFallback
                        title={event.artistName ?? event.name}
                        subtitle={dateLabel}
                        className="h-full w-full"
                      />
                    }
                  />
                  <span className="pointer-events-none absolute top-2.5 left-2.5 rounded-lg border border-line-gold bg-bg/90 px-2.5 py-1 text-[11.5px] font-bold text-gold-bright">
                    {dateLabel}
                  </span>
                  <span
                    className={cn(
                      "pointer-events-none absolute top-2.5 right-2.5 rounded-full bg-bg/85 px-2.5 py-1 text-[10.5px] font-bold uppercase",
                      open ? "text-success" : "text-danger",
                    )}
                  >
                    {saleStateLabel(event.saleState)}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-1.5 p-[18px]">
                  <h2 className="font-serif text-[26px] leading-[1.1] text-ivory">{event.artistName ?? event.name}</h2>
                  <p className="text-[13px] text-muted">{`${event.name} · Saat ${timeLabel}`}</p>
                  {event.isDemo ? (
                    <div className="pt-1">
                      <span className="rounded-full border border-gold px-2.5 py-0.5 text-[11px] font-semibold text-gold">
                        DEMO
                      </span>
                    </div>
                  ) : null}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3.5">
                    <span className="text-xs font-semibold text-gold-bright">
                      {event.minPrice !== null ? `${formatMoney(event.minPrice, event.currency)}'den` : "—"}
                    </span>
                    <div className="flex gap-2">
                      <ButtonLink href={`/etkinlik/${event.id}`} variant="glass" className="min-h-10 px-3.5 py-1.5 text-xs">
                        Detaylar
                      </ButtonLink>
                      {open ? (
                        <ButtonLink href={`/etkinlik/${event.id}#bilet-al`} variant="gold" className="min-h-10 px-3.5 py-1.5 text-xs">
                          Bilet Al
                        </ButtonLink>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
