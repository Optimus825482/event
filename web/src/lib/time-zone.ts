/** Uygulamanın iş saat dilimi (Kıbrıs). Gün sınırları ve tarih biçimleri bunu kullanır. */
export const APP_TIME_ZONE = "Asia/Famagusta";

type Fields = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Anın verilen bölgedeki duvar saati alanları. */
function zonedFields(instant: Date, timeZone: string): Fields {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timeZone, formatter);
  }
  const out: Record<string, number> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") out[part.type] = Number(part.value);
  }
  return out as Fields;
}

/** Verilen anda bölgenin UTC'ye göre ofseti (ms): yaz saatinde +3 sa, kışın +2 sa (Kıbrıs). */
export function zoneOffsetMs(instant: Date, timeZone: string = APP_TIME_ZONE): number {
  const f = zonedFields(instant, timeZone);
  const asUtc = Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute, f.second);
  // Milisaniye kısmı biçimlendirmede yok; karşılaştırmadan önce saniyeye indirilir.
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Anın bölge takvimindeki gün başlangıcı (yerel 00:00 anı). Yaz saati geçiş günleri
 * 23 ya da 25 saat sürer; sabit ofset değil, her aday anın gerçek ofseti kullanılır.
 */
export function zonedDayStart(instant: Date, timeZone: string = APP_TIME_ZONE): Date {
  const f = zonedFields(instant, timeZone);
  const localMidnightAsUtc = Date.UTC(f.year, f.month - 1, f.day);
  // Ofset gün içinde değişebilir: önce günün ofsetiyle tahmin et, sonra tahminin kendi ofsetiyle düzelt.
  let guess = localMidnightAsUtc - zoneOffsetMs(instant, timeZone);
  for (let i = 0; i < 3; i++) {
    const next = localMidnightAsUtc - zoneOffsetMs(new Date(guess), timeZone);
    if (next === guess) break;
    guess = next;
  }
  return new Date(guess);
}

/** Anın bölge takvimindeki sonraki günün başlangıcı (gün 23/25 saat sürebilir; 24 saat eklenmez). */
export function zonedNextDayStart(instant: Date, timeZone: string = APP_TIME_ZONE): Date {
  // 36 saat sonrası, gün 23 ile 25 saat arasında olduğundan her zaman sonraki gün içine düşer.
  return zonedDayStart(new Date(zonedDayStart(instant, timeZone).getTime() + 36 * 3_600_000), timeZone);
}

const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Anın bölge duvar saatini `datetime-local` biçiminde (`YYYY-AA-GGTSS:dd`) verir. */
export function dateToZonedWallClock(instant: Date, timeZone: string = APP_TIME_ZONE): string {
  const f = zonedFields(instant, timeZone);
  const p = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${p(f.year, 4)}-${p(f.month)}-${p(f.day)}T${p(f.hour)}:${p(f.minute)}`;
}

/**
 * `datetime-local` duvar saatini (`YYYY-AA-GGTSS:dd`) bölgedeki ana çevirir; biçim ya da tarih geçersizse `null`.
 * Yaz saati geçişlerinde sonuç belirlidir:
 * - Var olmayan saat (Mart, 03:00-03:59 atlanır): geçiş öncesi ofset kullanılır, yani saat ileri kayar (03:30 -> 04:30).
 * - İki kez yaşanan saat (Ekim, 03:00-03:59): ilk yaşanan (yaz saati, daha erken an) seçilir.
 */
export function zonedWallClockToDate(wallClock: string, timeZone: string = APP_TIME_ZONE): Date | null {
  const m = WALL_CLOCK.exec(wallClock);
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1).map(Number) as [number, number, number, number, number];
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(wall);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour
  ) {
    return null;
  }
  const DAY = 24 * 3_600_000;
  const before = zoneOffsetMs(new Date(wall - DAY), timeZone);
  const after = zoneOffsetMs(new Date(wall + DAY), timeZone);
  // Aday ofsetlerden gerçekten o duvar saatini üretenler geçerlidir.
  const valid = [...new Set([before, after])]
    .map((offset) => wall - offset)
    .filter((candidate) => dateToZonedWallClock(new Date(candidate), timeZone) === wallClock);
  if (valid.length > 0) return new Date(Math.min(...valid));
  return new Date(wall - before);
}
