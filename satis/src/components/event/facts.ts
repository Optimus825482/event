import type { EventDetail, SaleMode } from "@/lib/core/contract";
import { formatMoney } from "@/lib/format";
import { formatEventDate, formatEventTime } from "@/lib/time-zone";

export type EventFact = { label: string; value: string };

export function eventFacts(event: EventDetail): EventFact[] {
  const facts: EventFact[] = [{ label: "Tarih", value: formatEventDate(event.startsAt) }];
  if (event.site.doorsOpenAt) {
    facts.push({ label: "Kapı Açılış", value: formatEventTime(event.site.doorsOpenAt) });
  }
  facts.push({ label: "Konser Saati", value: formatEventTime(event.startsAt) });
  if (event.site.ageLimit) {
    facts.push({ label: "Yaş Sınırı", value: event.site.ageLimit });
  }
  if (event.minPrice !== null) {
    facts.push({ label: "Başlangıç Fiyatı", value: `${formatMoney(event.minPrice, event.currency)} / kişi` });
  }
  return facts;
}

export function partyOptions(maxSeatsPerOrder: number): number[] {
  const count = Math.max(1, Math.min(12, maxSeatsPerOrder));
  return Array.from({ length: count }, (_, i) => i + 1);
}

export function saleModeNote(mode: SaleMode): string {
  return mode === "seat"
    ? "Sandalye bazlı satış: salondan masanızı ve numaralı sandalyelerinizi seçersiniz."
    : "Masa bazlı satış: masalar bütün olarak satılır.";
}
