"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { realtimeKeys } from "@/features/realtime/keys";
import { useEventStream } from "@/features/realtime/use-event-stream";
import { DEMO_NOTICE } from "@/features/sales-api/contract";
import { formatDate } from "@/lib/utils";
import { ordersOverviewAction } from "../actions";
import { formatPnr } from "../pnr";
import type { OrderListRow, OrdersOverview } from "../queries";
import { formatMoney } from "../view-model";
import { DemoBadge, DemoNotice, OrderStatusBadge } from "./badges";
import { OccupancyList } from "./occupancy-list";

const linkClass =
  "inline-flex min-h-11 items-center font-mono font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function OrdersTable({ eventId, rows }: { eventId: string; rows: OrderListRow[] }) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Henüz sipariş yok</p>;
  }
  return (
    <Table className="min-w-[860px]">
      <TableHeader>
        <TableRow>
          <TableHead>PNR</TableHead>
          <TableHead>Alıcı</TableHead>
          <TableHead>Masalar</TableHead>
          <TableHead className="text-right">Adet</TableHead>
          <TableHead className="text-right">Tutar</TableHead>
          <TableHead>Durum</TableHead>
          <TableHead>E-bilet</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.orderId} className="align-top">
            <TableCell>
              <Link href={`/events/${eventId}/orders/${row.orderId}`} className={linkClass}>
                {row.pnr ? formatPnr(row.pnr) : "Ayrıntı"}
              </Link>
              {row.isDemo ? <DemoNotice text={DEMO_NOTICE} className="mt-1 max-w-[16rem] px-2 py-1 text-xs" /> : null}
            </TableCell>
            <TableCell>
              {row.buyerName ?? <span className="text-muted-foreground">—</span>}
              {row.buyerEmail ? <p className="text-xs text-muted-foreground">{row.buyerEmail}</p> : null}
            </TableCell>
            <TableCell>{row.tableLabels.join(", ") || "—"}</TableCell>
            <TableCell className="text-right tabular-nums">{row.seatCount}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMoney(row.total, row.currency)}</TableCell>
            <TableCell>
              <div className="flex flex-wrap items-center gap-1">
                <OrderStatusBadge status={row.status} />
                {row.isDemo ? <DemoBadge /> : null}
              </div>
              {row.status === "pending" ? (
                <p className="mt-1 text-xs text-muted-foreground">Süre: {formatDate(row.holdExpiresAt, "time")}</p>
              ) : null}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {row.eticketSentAt ? formatDate(row.eticketSentAt, "datetime") : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Özet kartları + doluluk + sipariş tablosu; `order.paid` / `seats.changed` olaylarında yenilenir. */
export function OrdersLive({ initial }: { initial: OrdersOverview }) {
  const { eventId } = initial;
  useEventStream(eventId);
  const query = useQuery({
    queryKey: realtimeKeys.orders(eventId),
    queryFn: async (): Promise<OrdersOverview> => {
      const result = await ordersOverviewAction({ eventId });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    initialData: initial,
    staleTime: 30_000,
  });
  const view = query.data;
  const cards = [
    { key: "issued", label: "Satılan bilet", value: String(view.totals.issued) },
    { key: "revenue", label: "Gelir", value: formatMoney(view.totals.revenue, view.currency) },
    ...(view.totals.demoIssued > 0
      ? [
          { key: "demoIssued", label: "Demo bilet", value: String(view.totals.demoIssued) },
          { key: "demoRevenue", label: "Demo gelir", value: formatMoney(view.totals.demoRevenue, view.currency) },
        ]
      : []),
  ];

  return (
    <div className="min-w-0 space-y-6">
      <section aria-label="Özet" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.key} className="rounded-xl border border-border bg-card p-4 text-card-foreground">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{card.value}</p>
          </div>
        ))}
      </section>
      <OccupancyList rows={view.occupancy} />
      <section aria-labelledby="orders-list-heading" className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4 text-card-foreground">
        <h2 id="orders-list-heading" className="text-lg font-semibold">
          Siparişler
        </h2>
        <OrdersTable eventId={eventId} rows={view.orders} />
      </section>
    </div>
  );
}
