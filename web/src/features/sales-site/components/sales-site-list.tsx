import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SALE_MODE_LABELS } from "@/domain/seating";
import { formatMoney } from "@/features/ticketing/view-model";
import { formatDate } from "@/lib/utils";
import { IMAGE_SLOT_LABELS } from "../image-status";
import { siteStateLabel } from "../labels";
import type { SalesSiteOverview, SalesSummaryRow } from "../overview";

function SummaryGroup({ title, items }: { title: string; items: SalesSummaryRow[] }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((row) => (
          <div
            key={`${row.isDemo ? "demo" : "real"}-${row.currency}`}
            className="grid grid-cols-2 gap-4 rounded-lg border bg-card p-4"
          >
            <div>
              <p className="text-xs text-muted-foreground">Bugün ({row.currency})</p>
              <p className="text-lg font-semibold tabular-nums">{formatMoney(row.todayRevenue, row.currency)}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{row.todayTickets} bilet</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Toplam ({row.currency})</p>
              <p className="text-lg font-semibold tabular-nums">{formatMoney(row.totalRevenue, row.currency)}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{row.totalTickets} bilet</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SalesSiteList({ overview }: { overview: SalesSiteOverview }) {
  const realSummary = overview.summary?.filter((s) => !s.isDemo) ?? [];
  const demoSummary = overview.summary?.filter((s) => s.isDemo) ?? [];

  return (
    <div className="space-y-6">
      {overview.demoEnabled ? (
        <div
          role="status"
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200"
        >
          DEMO AKTİF
        </div>
      ) : null}

      {overview.summary !== null ? (
        overview.summary.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz satış yok</p>
        ) : (
          <div className="space-y-4">
            <SummaryGroup title="Gerçek satış" items={realSummary} />
            <SummaryGroup title="Demo satış" items={demoSummary} />
          </div>
        )
      ) : null}

      {overview.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz etkinlik yok</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Etkinlik</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Sitedeki durum</TableHead>
                <TableHead>Doluluk</TableHead>
                <TableHead>Satılan</TableHead>
                <TableHead>Satış şekli</TableHead>
                <TableHead>Görseller</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.rows.map((row) => (
                <TableRow key={row.eventId}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Link href={`/sales-site/${row.eventId}`} className="hover:underline">
                        {row.name}
                      </Link>
                      {row.isDemo ? <Badge variant="secondary">DEMO</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(row.startsAt)}</TableCell>
                  <TableCell>{siteStateLabel(row.siteState)}</TableCell>
                  <TableCell className="tabular-nums">
                    {row.occupancyPercent !== null ? `%${row.occupancyPercent}` : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums">{row.sold !== null ? String(row.sold) : "—"}</TableCell>
                  <TableCell>{SALE_MODE_LABELS[row.saleMode]}</TableCell>
                  <TableCell>
                    {row.images.status === "complete"
                      ? "Tam"
                      : `Eksik: ${row.images.missing.map((slot) => IMAGE_SLOT_LABELS[slot]).join(", ")}`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
