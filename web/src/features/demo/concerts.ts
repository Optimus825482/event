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
  /** Kapak (`events.cover_image`): konser afişi. */
  poster: string;
  /** Site hero görseli: varsa videodan üretilmiş hareketli WebP klip, yoksa afiş. */
  hero: string;
  artistImage: string;
  summary: string;
};

export const DEMO_ASSET_DIR = "public/demo-seed";
export const DEMO_DESCRIPTION = "Merit Royal Diamond · temsili demo etkinliği";

/** Prototiplerdeki (bilet1, bilet2) yaklaşan konserler; tarihler bugünden itibaren gün ofsetiyle yayılır. */
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
    hero: "selcuk-clip.webp",
    artistImage: "selcuk-artist.jpg",
    summary: "Karadeniz müziğinin sevilen sesi Selçuk Balcı, Merit Royal Diamond sahnesinde unutulmaz bir kış gecesi sunuyor.",
  },
  {
    key: "yorgo",
    name: "Yorgo Kertis · Canlı Konser",
    artistName: "Yorgo Kertis",
    dayOffset: 12,
    time: "22:00",
    doors: "20:00",
    basePrice: 6000,
    poster: "yorgo-poster.webp",
    hero: "yorgo-poster.webp",
    artistImage: "yorgo-poster.webp",
    summary: "Ege'nin iki yakasından ezgileri buluşturan Yorgo Kertis, canlı konseriyle Merit Royal Diamond'da sıcak bir gece vaat ediyor.",
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
    hero: "levent-clip.webp",
    artistImage: "levent-artist.jpg",
    summary: "Türk pop müziğinin usta yorumcusu Levent Yüksel, orkestrasıyla Aralık Galası'nda Merit Royal Diamond'da.",
  },
  {
    key: "buray",
    name: "Buray · Gala Konseri",
    artistName: "Buray",
    dayOffset: 22,
    time: "22:00",
    doors: "20:00",
    basePrice: 8500,
    poster: "buray-poster.webp",
    hero: "buray-clip.webp",
    artistImage: "buray-artist.jpg",
    summary: "Yeni kuşak popun güçlü sesi Buray, sevilen şarkılarıyla Merit Royal Diamond gala sahnesinde dinleyicileriyle buluşuyor.",
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
    hero: "serkan-clip.webp",
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
    hero: "ziynet-clip.webp",
    artistImage: "ziynet-artist.jpg",
    summary: "Ziynet Sali, enerjik sahne performansı ve seçkin orkestrasıyla Yeni Yıl Galası'nda dinleyicileriyle buluşuyor.",
  },
  {
    key: "nukhet",
    name: "Nükhet Duru · Gala Gecesi",
    artistName: "Nükhet Duru",
    dayOffset: 48,
    time: "22:00",
    doors: "20:00",
    basePrice: 9000,
    poster: "nukhet-poster.webp",
    hero: "nukhet-clip.webp",
    artistImage: "nukhet-artist.webp",
    summary: "Türk pop müziğinin efsane sesi Nükhet Duru, unutulmaz şarkılarıyla Merit Royal Diamond'da zarif bir gala gecesine eşlik ediyor.",
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
    hero: "kirac-clip.webp",
    artistImage: "kirac-artist.jpg",
    summary: "Anadolu rock'ın güçlü sesi Kıraç, klasikleşmiş şarkılarıyla Merit Royal Diamond gala gecesinde sahnede.",
  },
  {
    key: "umit-pamela",
    name: "Ümit Besen & Pamela · Özel Konser",
    artistName: "Ümit Besen & Pamela",
    dayOffset: 70,
    time: "22:30",
    doors: "20:30",
    basePrice: 8000,
    poster: "umit-pamela-poster.webp",
    hero: "umit-pamela-clip.webp",
    artistImage: "umit-pamela-artist.jpg",
    summary: "Arabeskin usta ismi Ümit Besen ve güçlü sesiyle Pamela, kuşakları buluşturan ortak sahneleriyle Merit Royal Diamond'da.",
  },
  {
    key: "ziynet-bahar",
    name: "Ziynet Sali · Bahar Galası",
    artistName: "Ziynet Sali",
    dayOffset: 100,
    time: "22:00",
    doors: "20:00",
    basePrice: 9500,
    poster: "ziynet-bahar-poster.webp",
    hero: "ziynet-clip.webp",
    artistImage: "ziynet-artist.jpg",
    summary: "Ziynet Sali, baharın ilk gala gecesinde hareketli repertuvarı ve canlı orkestrasıyla yeniden Merit Royal Diamond sahnesinde.",
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
