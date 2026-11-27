import { dateKeyOf } from "@/lib/time-zone";

export type Month = { year: number; month: number };

export const WEEKDAYS = [
  ["Pzt", "Pazartesi"],
  ["Sal", "Salı"],
  ["Çar", "Çarşamba"],
  ["Per", "Perşembe"],
  ["Cum", "Cuma"],
  ["Cmt", "Cumartesi"],
  ["Paz", "Pazar"],
] as const;

const MONTH_PARAM_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function parseMonthParam(raw: string | string[] | undefined): Month | undefined {
  if (typeof raw !== "string") return undefined;
  const match = MONTH_PARAM_RE.exec(raw);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2020 || year > 2100) return undefined;
  return { year, month };
}

export function monthParam(m: Month): string {
  return `${m.year}-${String(m.month).padStart(2, "0")}`;
}

export function shiftMonth(m: Month, by: 1 | -1): Month {
  const total = m.year * 12 + (m.month - 1) + by;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

export function defaultMonth(events: { startsAt: string }[], today: string): Month {
  const futureKeys = events.map((e) => dateKeyOf(e.startsAt)).filter((k) => k >= today).sort();
  const target = futureKeys[0] ?? today;
  const [y, m] = target.split("-");
  return { year: Number(y), month: Number(m) };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatUtcKey(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function buildMonthGrid(m: Month): { key: string; day: number; inMonth: boolean }[][] {
  const first = new Date(Date.UTC(m.year, m.month - 1, 1));
  const last = new Date(Date.UTC(m.year, m.month, 0));
  const startOffset = (first.getUTCDay() + 6) % 7;
  const totalDays = last.getUTCDate();
  const weekCount = Math.ceil((startOffset + totalDays) / 7);

  const weeks: { key: string; day: number; inMonth: boolean }[][] = [];
  for (let w = 0; w < weekCount; w++) {
    const week: { key: string; day: number; inMonth: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const cellOffset = w * 7 + d - startOffset;
      const date = new Date(Date.UTC(m.year, m.month - 1, 1 + cellOffset));
      week.push({
        key: formatUtcKey(date),
        day: date.getUTCDate(),
        inMonth: date.getUTCFullYear() === m.year && date.getUTCMonth() + 1 === m.month,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

export function groupByDateKey<T extends { startsAt: string }>(events: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const event of events) {
    const key = dateKeyOf(event.startsAt);
    const list = map.get(key);
    if (list) list.push(event);
    else map.set(key, [event]);
  }
  return map;
}
