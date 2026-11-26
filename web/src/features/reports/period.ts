import { z } from "zod";
import { dateToZonedWallClock, zonedDayStart, zonedNextDayStart } from "@/lib/time-zone";

// Dönem raporu girdisi (saf). `from`/`to` Kıbrıs takvim günleridir, ikisi de dahil.

export type PeriodInput = { from: string; to: string };

const MAX_DAYS = 1830;
const DAY_MS = 86_400_000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const INVALID_DATE = "Geçerli bir tarih girin";

/** `YYYY-AA-GG` biçimli ve takvimde var olan günün UTC gün numarası; değilse null. */
function dayNumber(value: string): number | null {
  const m = DATE_PATTERN.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return ms / DAY_MS;
}

const dateField = z.string().refine((v) => dayNumber(v) !== null, INVALID_DATE);

export const periodSchema = z.object({ from: dateField, to: dateField }).superRefine((value, ctx) => {
  const from = dayNumber(value.from);
  const to = dayNumber(value.to);
  if (from === null || to === null) return;
  if (to < from) {
    ctx.addIssue({ code: "custom", path: ["to"], message: "Bitiş, başlangıçtan önce olamaz" });
  } else if (to - from > MAX_DAYS) {
    ctx.addIssue({ code: "custom", path: ["to"], message: "Dönem en fazla 5 yıl olabilir" });
  }
});

/** Öğlen UTC, Kıbrıs'ta (UTC+2/+3) her zaman aynı takvim gününe düşer. */
export function periodBounds(p: PeriodInput): { start: Date; endExclusive: Date } {
  return {
    start: zonedDayStart(new Date(`${p.from}T12:00:00Z`)),
    endExclusive: zonedNextDayStart(new Date(`${p.to}T12:00:00Z`)),
  };
}

/** Kıbrıs takvim yılının 1 Ocak'ı – Kıbrıs'ta bugün. */
export function defaultPeriod(now: Date): PeriodInput {
  const today = dateToZonedWallClock(now).slice(0, 10);
  return { from: `${today.slice(0, 4)}-01-01`, to: today };
}
