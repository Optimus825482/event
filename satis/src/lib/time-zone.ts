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

/** `"31 Aralık 2026 Perşembe · 21:00"` biçiminde etkinlik zamanı. */
export function formatEventWhen(iso: string): string {
  const date = new Date(iso);
  return `${dateFormat.format(date)} · ${timeFormat.format(date)}`;
}
