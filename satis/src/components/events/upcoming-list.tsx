"use client";

import { useState } from "react";
import { Notice } from "@/components/ui/notice";
import { EventCard } from "@/features/plan/event-card";
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
      <div className="flex flex-wrap gap-2.5">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sanatçı ara..."
          aria-label="Sanatçı veya etkinlik ara"
          className="min-w-[min(100%,220px)] flex-1 rounded-[12px] border border-line bg-surface px-3.5 py-2.5 text-[13.5px] text-ivory placeholder:text-muted focus:border-gold focus:outline-none"
        />
        <select
          aria-label="Satış durumu filtresi"
          value={onlyOpen ? "open" : "all"}
          onChange={(e) => setOnlyOpen(e.target.value === "open")}
          className="min-w-[140px] flex-1 rounded-[12px] border border-line bg-surface px-3.5 py-2.5 text-[13.5px] text-ivory focus:border-gold focus:outline-none sm:flex-none"
        >
          <option value="all">Tüm Etkinlikler</option>
          <option value="open">Yalnızca Satışta</option>
        </select>
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
