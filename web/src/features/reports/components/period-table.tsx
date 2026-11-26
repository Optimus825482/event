import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArchiveTable } from "@/features/archive/components/archive-table";
import { NetAmount } from "@/features/archive/components/net-amount";
import { DEMO_NOTICE, formatMoney, formatRate } from "@/features/archive/format";
import type { PeriodReport } from "../service";

/** Dönem raporu: etkinlik satırları ve para birimi başına toplamlar. Sunucu bileşeni. */
export function PeriodTable({ report }: { report: PeriodReport }) {
  if (report.rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Bu dönemde arşivlenmiş etkinlik yok.</p>;
  }
  const hasDemo = report.totals.some((t) => t.demoTicketsSold > 0);
  return (
    <div className="space-y-6">
      <ArchiveTable items={report.rows} caption="Dönem raporu" />
      <section aria-labelledby="period-totals" className="space-y-2">
        <h2 id="period-totals" className="text-lg font-medium text-foreground">
          Para birimi başına toplamlar
        </h2>
        <Table>
          <caption className="sr-only">Para birimi başına toplamlar</caption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Para birimi</TableHead>
              <TableHead scope="col" className="text-right">Etkinlik</TableHead>
              <TableHead scope="col" className="text-right">Satılan bilet</TableHead>
              <TableHead scope="col" className="text-right">Bilet geliri</TableHead>
              <TableHead scope="col" className="text-right">Net (gerçekleşen)</TableHead>
              <TableHead scope="col" className="text-right">Doluluk</TableHead>
              <TableHead scope="col" className="text-right">Katılım</TableHead>
              <TableHead scope="col" className="text-right">No-show</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.totals.map((t) => (
              <TableRow key={t.currency}>
                <TableCell className="font-medium text-foreground">{t.currency}</TableCell>
                <TableCell className="text-right tabular-nums text-foreground">{t.eventCount}</TableCell>
                <TableCell className="text-right tabular-nums text-foreground">{t.ticketsSold}</TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums text-foreground">
                  {formatMoney(t.ticketRevenue, t.currency)}
                </TableCell>
                <TableCell className="text-right">
                  <NetAmount amount={t.netActual} currency={t.currency} />
                </TableCell>
                <TableCell className="text-right tabular-nums text-foreground">{formatRate(t.rates.occupancy)}</TableCell>
                <TableCell className="text-right tabular-nums text-foreground">{formatRate(t.rates.attendance)}</TableCell>
                <TableCell className="text-right tabular-nums text-foreground">{formatRate(t.rates.noShow)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {hasDemo ? (
          <div className="rounded-lg border border-amber-700 p-3 text-sm text-amber-900 dark:border-amber-400 dark:text-amber-200">
            <p className="font-medium">{DEMO_NOTICE}</p>
            <ul className="mt-1 space-y-0.5">
              {report.totals
                .filter((t) => t.demoTicketsSold > 0)
                .map((t) => (
                  <li key={t.currency}>
                    Demo satış ({t.currency}): {t.demoTicketsSold} bilet, {formatMoney(t.demoTicketRevenue, t.currency)}
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
