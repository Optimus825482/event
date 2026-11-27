import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { saleStateLabel } from "@/features/plan/sale-state";
import type { EventCard as EventCardData } from "@/lib/core/contract";
import { cn } from "@/lib/cn";
import { formatEventDate, formatEventTime, formatMonthTitle } from "@/lib/time-zone";
import { buildMonthGrid, groupByDateKey, monthParam, shiftMonth, WEEKDAYS, type Month } from "./month";

export function MonthView({ month, events }: { month: Month; events: EventCardData[] }): React.JSX.Element {
  const title = formatMonthTitle(month.year, month.month);
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const prevTitle = formatMonthTitle(prev.year, prev.month);
  const nextTitle = formatMonthTitle(next.year, next.month);

  const grid = buildMonthGrid(month);
  const byDay = groupByDateKey(events);
  const prefix = `${monthParam(month)}-`;
  const monthEvents = events.filter((e) => {
    const key = [...byDay.entries()].find(([, list]) => list.includes(e))?.[0] ?? "";
    return key.startsWith(prefix);
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/takvim?ay=${monthParam(prev)}`} className={buttonClass("glass")}>
          {`← ${prevTitle}`}
        </Link>
        <h2 className="text-[clamp(26px,3.5vw,38px)] text-ivory">{title}</h2>
        <Link href={`/takvim?ay=${monthParam(next)}`} className={buttonClass("glass")}>
          {`${nextTitle} →`}
        </Link>
      </div>

      <table className="hidden w-full table-fixed border-collapse border border-line sm:table">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr className="bg-surface">
            {WEEKDAYS.map(([short, full]) => (
              <th
                key={short}
                scope="col"
                className="border border-line px-2 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-gold-bright"
              >
                <abbr title={full} className="no-underline">
                  {short}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((week) => (
            <tr key={week[0]!.key}>
              {week.map((cell) => {
                const dayEvents = byDay.get(cell.key) ?? [];
                return (
                  <td
                    key={cell.key}
                    className={cn(
                      "h-28 border border-line p-2 align-top",
                      cell.inMonth ? "bg-surface-raised" : "bg-bg",
                    )}
                  >
                    <span className={cn("text-xs font-semibold", cell.inMonth ? "text-ivory" : "text-muted")}>
                      {cell.day}
                    </span>
                    {dayEvents.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {dayEvents.map((ev) => (
                          <li key={ev.id}>
                            <Link
                              href={`/etkinlik/${ev.id}`}
                              className="block rounded bg-glass px-1.5 py-1 text-xs font-medium text-gold-bright no-underline hover:bg-gold hover:text-on-gold"
                            >
                              {`${formatEventTime(ev.startsAt)} ${ev.name}`}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <section aria-label="Ayın etkinlikleri listesi" className="space-y-4">
        <h3 className="text-2xl text-ivory">Ayın Etkinlikleri</h3>
        {monthEvents.length === 0 ? (
          <Notice>Bu ay etkinlik yok.</Notice>
        ) : (
          <ol aria-label="Ayın etkinlikleri" className="space-y-3">
            {monthEvents.map((ev) => (
              <li
                key={ev.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-line bg-surface-raised p-4"
              >
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gold-bright">
                    {`${formatEventDate(ev.startsAt)} · ${formatEventTime(ev.startsAt)}`}
                  </p>
                  <Link href={`/etkinlik/${ev.id}`} className="font-serif text-xl text-ivory no-underline hover:text-gold-bright">
                    {ev.name}
                  </Link>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">
                    {saleStateLabel(ev.saleState)}
                  </span>
                  <Link href={`/etkinlik/${ev.id}`} className={buttonClass("glass")}>
                    İncele
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
