/** Uygulamanın tek saat dilimi (Kıbrıs). Başka saat dilimi yazılmaz. */
export const APP_TIME_ZONE = "Asia/Famagusta";

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
  weekday: "long",
});
const timeFormat = new Intl.DateTimeFormat("tr-TR", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const dateKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const monthTitleFormat = new Intl.DateTimeFormat("tr-TR", {
  timeZone: APP_TIME_ZONE,
  month: "long",
  year: "numeric",
});

/** `"31 Aralık 2026 Perşembe · 21:00"` biçiminde etkinlik zamanı. */
export function formatEventWhen(iso: string): string {
  const date = new Date(iso);
  return `${dateFormat.format(date)} · ${timeFormat.format(date)}`;
}

/** `"15 Ocak 2027 Cuma"` biçiminde etkinlik tarihi. */
export function formatEventDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/** `"20:00"` biçiminde etkinlik saati. */
export function formatEventTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

/** `"2027-01-15"` biçiminde Kıbrıs gün anahtarı. */
export function dateKeyOf(iso: string): string {
  return dateKeyFormat.format(new Date(iso));
}

/** `"Ocak 2027"` biçiminde ay başlığı (`month` 1–12). */
export function formatMonthTitle(year: number, month: number): string {
  return monthTitleFormat.format(new Date(Date.UTC(year, month - 1, 15, 12)));
}

/** Verilen anın Kıbrıs takvimindeki gün anahtarı (`"2027-01-01"`). */
export function todayKey(now: Date = new Date()): string {
  return dateKeyFormat.format(now);
}

const dayFormat = new Intl.DateTimeFormat("tr-TR", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** `"15 Ocak 2027"` biçiminde (haftanın günü olmadan) etkinlik günü. */
export function formatEventDay(iso: string): string {
  return dayFormat.format(new Date(iso));
}
