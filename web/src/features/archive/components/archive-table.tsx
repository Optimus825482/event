import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import type { ArchiveSummary } from "../read";
import { formatMoney, formatRate } from "../format";
import { DemoBadge } from "./demo-badge";
import { NetAmount } from "./net-amount";

/** Arşiv satırları (liste, dönem raporu ve sanatçı geçmişi ortak tablosu). Sunucu bileşeni. */
export function ArchiveTable({ items, caption, showArtist = true }: { items: ArchiveSummary[]; caption: string; showArtist?: boolean }) {
  return (
    <Table>
      <caption className="sr-only">{caption}</caption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Etkinlik</TableHead>
          <TableHead scope="col">Tarih</TableHead>
          {showArtist ? <TableHead scope="col">Sanatçı</TableHead> : null}
          <TableHead scope="col" className="text-right">Satılan bilet</TableHead>
          <TableHead scope="col" className="text-right">Bilet geliri</TableHead>
          <TableHead scope="col" className="text-right">Net (gerçekleşen)</TableHead>
          <TableHead scope="col" className="text-right">Doluluk</TableHead>
          <TableHead scope="col" className="text-right">Katılım</TableHead>
          <TableHead scope="col" className="text-right">No-show</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((row) => (
          <TableRow key={row.eventId}>
            <TableCell className="text-foreground">
              <div className="flex flex-col items-start gap-1">
                <Link
                  href={`/archive/${row.eventId}`}
                  className="font-medium text-blue-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-blue-300"
                >
                  {row.eventName}
                </Link>
                {row.hasDemo ? <DemoBadge count={row.demoTicketsSold} /> : null}
              </div>
            </TableCell>
            <TableCell className="whitespace-nowrap text-foreground">{formatDate(row.startsAt, "datetime")}</TableCell>
            {showArtist ? <TableCell className="text-foreground">{row.artistName ?? "—"}</TableCell> : null}
            <TableCell className="text-right tabular-nums text-foreground">{row.ticketsSold}</TableCell>
            <TableCell className="whitespace-nowrap text-right tabular-nums text-foreground">
              {formatMoney(row.ticketRevenue, row.currency)}
            </TableCell>
            <TableCell className="text-right">
              <NetAmount amount={row.netActual} currency={row.currency} />
            </TableCell>
            <TableCell className="text-right tabular-nums text-foreground">{formatRate(row.rates.occupancy)}</TableCell>
            <TableCell className="text-right tabular-nums text-foreground">{formatRate(row.rates.attendance)}</TableCell>
            <TableCell className="text-right tabular-nums text-foreground">{formatRate(row.rates.noShow)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
