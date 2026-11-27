import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatRate } from "@/features/archive/format";
import { formatDate } from "@/lib/utils";
import type { ArtistComparisonRow } from "../comparison";

/** Sanatçı karşılaştırması; birden çok para biriminde her biri ayrı satırdadır. Sunucu bileşeni. */
export function ArtistTable({ rows }: { rows: ArtistComparisonRow[] }) {
  return (
    <Table>
      <caption className="sr-only">Sanatçı karşılaştırması</caption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Sanatçı</TableHead>
          <TableHead scope="col">Tür</TableHead>
          <TableHead scope="col" className="text-right">Etkinlik sayısı</TableHead>
          <TableHead scope="col">Son etkinlik</TableHead>
          <TableHead scope="col" className="text-right">Satılan bilet</TableHead>
          <TableHead scope="col" className="text-right">Bilet geliri</TableHead>
          <TableHead scope="col" className="text-right">Katılım</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.flatMap((row) => {
          const lines = row.totals.length > 0 ? row.totals : [null];
          return lines.map((t, i) => (
            <TableRow key={`${row.artist.id}-${t?.currency ?? "none"}`}>
              <TableCell className="text-foreground">
                <Link
                  href={`/artists/${row.artist.id}`}
                  className="font-medium text-blue-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-blue-300"
                >
                  {row.artist.name}
                </Link>
                {!row.artist.isActive && i === 0 ? <span className="ml-2 text-xs text-muted-foreground">(<span className="sr-only">sanatçı </span>pasif)</span> : null}
              </TableCell>
              <TableCell className="text-foreground">{row.artist.genre ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums text-foreground">{t ? t.eventCount : row.eventCount}</TableCell>
              <TableCell className="whitespace-nowrap text-foreground">
                {row.lastEventAt ? formatDate(row.lastEventAt, "short") : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums text-foreground">{t ? t.ticketsSold : "—"}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums text-foreground">
                {t ? formatMoney(t.ticketRevenue, t.currency) : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums text-foreground">{t ? formatRate(t.rates.attendance) : "—"}</TableCell>
            </TableRow>
          ));
        })}
      </TableBody>
    </Table>
  );
}
