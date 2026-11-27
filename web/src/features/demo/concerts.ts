import type { SaleCategory } from "@/domain/seating";
import { dateToZonedWallClock, zonedDayStart, zonedWallClockToDate } from "@/lib/time-zone";

export type DemoConcert = {
  key: string;
  name: string;
  artistName: string;
  dayOffset: number;
  time: string;
  doors: string;
  basePrice: number;
  poster: string;
  artistImage: string;
  summary: string;
};

export const DEMO_HERO_FILE = "hero.jpg";
export const DEMO_ASSET_DIR = "public/demo-seed";
export const DEMO_DESCRIPTION = "Merit Royal Diamond · temsili demo etkinliği";

export const DEMO_CONCERTS: readonly DemoConcert[] = [
  {
    key: "selcuk",
    name: "Selçuk Balcı · Kış Konseri",
    artistName: "Selçuk Balcı",
    dayOffset: 8,
    time: "22:00",
    doors: "20:00",
    basePrice: 6500,
    poster: "selcuk-poster.webp",
    artistImage: "selcuk-artist.jpg",
    summary: "Karadeniz müziğinin sevilen sesi Selçuk Balcı, Merit Royal Diamond sahnesinde unutulmaz bir kış gecesi sunuyor.",
  },
  {
    key: "levent",
    name: "Levent Yüksel · Aralık Galası",
    artistName: "Levent Yüksel",
    dayOffset: 15,
    time: "22:00",
    doors: "20:00",
    basePrice: 7500,
    poster: "levent-poster.webp",
    artistImage: "levent-artist.jpg",
    summary: "Türk pop müziğinin usta yorumcusu Levent Yüksel, orkestrasıyla Aralık Galası'nda Merit Royal Diamond'da.",
  },
  {
    key: "serkan",
    name: "Serkan Kaya · Yılbaşı Özel",
    artistName: "Serkan Kaya",
    dayOffset: 34,
    time: "22:30",
    doors: "20:30",
    basePrice: 11000,
    poster: "serkan-poster.webp",
    artistImage: "serkan-artist.jpg",
    summary: "Yeni yıla Serkan Kaya'nın güçlü yorumu ve özel gala repertuvarıyla Merit Royal Diamond'da merhaba deyin.",
  },
  {
    key: "ziynet",
    name: "Ziynet Sali · Yeni Yıl Galası",
    artistName: "Ziynet Sali",
    dayOffset: 36,
    time: "22:00",
    doors: "20:00",
    basePrice: 9000,
    poster: "ziynet-poster.webp",
    artistImage: "ziynet-artist.jpg",
    summary: "Ziynet Sali, enerjik sahne performansı ve seçkin orkestrasıyla Yeni Yıl Galası'nda dinleyicileriyle buluşuyor.",
  },
  {
    key: "kirac",
    name: "Kıraç · Gala Konseri",
    artistName: "Kıraç",
    dayOffset: 50,
    time: "22:00",
    doors: "20:00",
    basePrice: 8500,
    poster: "kirac-poster.webp",
    artistImage: "kirac-artist.jpg",
    summary: "Anadolu rock'ın güçlü sesi Kıraç, klasikleşmiş şarkılarıyla Merit Royal Diamond gala gecesinde sahnede.",
  },
] as const;

/** Konserin Kıbrıs duvar saatine göre başlangıç, bitiş ve kapı açılış anlarını hesaplar. */
export function concertTimes(now: Date, concert: DemoConcert): { startsAt: Date; endsAt: Date; doorsOpenAt: Date } {
  const baseDay = zonedDayStart(now);
  const [datePart] = dateToZonedWallClock(baseDay).split("T");
  const [year, month, day] = datePart!.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(year, month - 1, day + concert.dayOffset));
  const y = String(target.getUTCFullYear()).padStart(4, "0");
  const m = String(target.getUTCMonth() + 1).padStart(2, "0");
  const d = String(target.getUTCDate()).padStart(2, "0");
  const targetDate = `${y}-${m}-${d}`;

  const startsAt = zonedWallClockToDate(`${targetDate}T${concert.time}`);
  const doorsOpenAt = zonedWallClockToDate(`${targetDate}T${concert.doors}`);
  if (!startsAt || !doorsOpenAt) {
    throw new Error(`Geçersiz demo konser saati: ${concert.key}`);
  }
  const endsAt = new Date(startsAt.getTime() + 3 * 3600_000);
  return { startsAt, endsAt, doorsOpenAt };
}

/** Taban fiyattan kategori fiyatlarını (standard, premium, vip) üretir. */
export function demoPrices(basePrice: number): Record<SaleCategory, string> {
  return {
    standard: basePrice.toFixed(2),
    premium: Math.round(basePrice * 1.85).toFixed(2),
    vip: Math.round(basePrice * 2.8).toFixed(2),
  };
}
