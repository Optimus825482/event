"use client";

import { useState } from "react";
import { Notice } from "@/components/ui/notice";
import { EventCard } from "@/features/plan/event-card";
import { cn } from "@/lib/cn";
import type { EventCard as EventCardData } from "@/lib/core/contract";

export function UpcomingList({ events }: { events: EventCardData[] }): React.JSX.Element {
  const [query, setQuery] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);

  const normalized = query.trim().toLocaleLowerCase("tr-TR");
  const filtered = events.filter((event) => {
    if (onlyOpen && event.saleState !== "open") return false;
    if (!normalized) return true;
    const nameMatch = event.name.toLocaleLowerCase("tr-TR").includes(normalized);
    const artistMatch = (event.artistName ?? "").toLocaleLowerCase("tr-TR").includes(normalized);
    return nameMatch || artistMatch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sanatçı veya etkinlik ara…"
          aria-label="Sanatçı veya etkinlik ara"
          className="min-w-[min(100%,240px)] flex-1 rounded-[12px] border border-line bg-surface px-4 py-2.5 text-sm text-ivory placeholder:text-muted focus:border-gold focus:outline-none"
        />
        <button
          type="button"
          aria-pressed={onlyOpen}
          onClick={() => setOnlyOpen((prev) => !prev)}
          className={cn(
            "inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
            onlyOpen
              ? "border-gold bg-gold text-on-gold"
              : "border-line bg-surface text-muted hover:border-gold hover:text-ivory",
          )}
        >
          Yalnızca satışta
        </button>
      </div>

      {filtered.length === 0 ? (
        <Notice>Aramanızla eşleşen etkinlik bulunamadı.</Notice>
      ) : (
        <div className="card-grid">
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} headingLevel={2} />
          ))}
        </div>
      )}
    </div>
  );
}
