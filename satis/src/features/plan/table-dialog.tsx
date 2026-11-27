"use client";

import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { SightlineSet } from "@/lib/core/contract";
import { formatMoney } from "@/lib/format";
import { ActiveTableCard } from "./active-table-card";
import type { PlanTableModel } from "./model";
import { PROCEED_LABEL, type Readiness, type TablePick } from "./picks";
import { sightlineSrc } from "./sightline";
import { SightlineImage } from "./sightline-panel";

export type TableDialogSale = {
  pick: TablePick | null;
  /** Bu masanın dışındaki seçimler (ör. "Masa A1 · sandalye 4, 7"). */
  otherPicks: string[];
  /** Tüm seçimin toplamı; fiyatı belirsizse `null`. */
  total: string | null;
  readiness: Readiness;
  pending: boolean;
  onToggleSeat(seatNo: number): void;
  onToggleWhole(): void;
  onProceed(): void;
};

export type TableDialogProps = {
  open: boolean;
  table: PlanTableModel | null;
  eventName: string;
  eventTime: string;
  sightlineSet: SightlineSet | null;
  /** `"39m · Sağ 30°"`; hesaplanamıyorsa `null` (gösterilmez). */
  metrics: string | null;
  unitPrice: string | null;
  currency: string;
  canLookIn3d: boolean;
  onLookIn3d(): void;
  onClose(): void;
  /** Satış açıkken seçim ve ödeme; kapalıyken `null` ve `closedLabel` yazılır. */
  sale: TableDialogSale | null;
  closedLabel?: string;
  /** Uyarılar (seçim değişikliği, tutma hatası). */
  children?: ReactNode;
};

type BodyProps = Omit<TableDialogProps, "open" | "table"> & { titleId: string; table: PlanTableModel };

function kindName(table: Pick<PlanTableModel, "isLoca" | "label">): string {
  return `${table.isLoca ? "Loca" : "Masa"} ${table.label}`;
}

function availabilityText(table: PlanTableModel): string {
  if (table.status === "not_sellable") return "Satışa kapalı";
  if (table.status === "sold_out" || table.freeSeats.length === 0) return "Müsait yer yok";
  return `${table.freeSeats.length} kişilik yer müsait`;
}

function selectionText(table: PlanTableModel, pick: TablePick | null): string {
  const name = kindName(table);
  if (!pick) return "Henüz seçim yok";
  if (pick.whole) return `${name} · ${table.seats ?? 0} Kişi (bütün ${table.isLoca ? "loca" : "masa"})`;
  return `${name} · ${pick.seatNos.length} Kişi · Sandalye ${pick.seatNos.join(", ")}`;
}

function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <dt className="shrink-0 text-sm text-muted">{label}</dt>
      <dd className={strong ? "text-right text-2xl font-bold text-gold" : "text-right text-sm font-semibold text-ivory"}>
        {children}
      </dd>
    </div>
  );
}

/** Masa/loca seçilince açılan bilgi penceresi: sahne görüşü, fiyat, sandalye seçimi ve ödemeye geçiş. */
export function TableDialog({ open, table, ...rest }: TableDialogProps) {
  const titleId = useId();
  return (
    <Modal open={open && table !== null} onClose={rest.onClose} labelledBy={titleId} className="max-w-[560px]">
      {table ? <TableDialogBody titleId={titleId} table={table} {...rest} /> : null}
    </Modal>
  );
}

function TableDialogBody({
  titleId,
  table,
  eventName,
  eventTime,
  sightlineSet,
  metrics,
  unitPrice,
  currency,
  canLookIn3d,
  onLookIn3d,
  onClose,
  sale,
  closedLabel,
  children,
}: BodyProps) {
  const name = kindName(table);
  const canProceed = sale !== null && sale.readiness.ready && !sale.pending && sale.total !== null;
  const hasPicks = sale !== null && (sale.pick !== null || sale.otherPicks.length > 0);

  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
        <div className="min-w-0">
          <h2 id={titleId} className="text-[26px] leading-tight text-ivory">
            {name}
          </h2>
          <p className="mt-1 text-sm text-muted">{availabilityText(table)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-gold px-2.5 py-0.5 text-[11px] font-bold tracking-[0.18em] text-gold">
            {table.isLoca ? "LOCA" : "MASA"}
          </span>
          <button
            type="button"
            aria-label="Pencereyi kapat"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line text-xl text-muted transition-colors hover:border-gold hover:text-ivory"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>

      <figure className="mx-5 overflow-hidden rounded-[14px] border border-line">
        <SightlineImage
          src={sightlineSrc(sightlineSet, table.label)}
          alt={`${name} konumundan sahnenin temsili görünümü`}
          fallback="Bu konum için sahne fotoğrafı yok."
        >
          <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-linear-to-t from-bg to-transparent px-3 pb-2 pt-8 text-xs font-semibold text-ivory">
            <span>{`${name} — Sahne Görünümü`}</span>
            {metrics ? <span className="text-gold-bright">{metrics}</span> : null}
          </figcaption>
        </SightlineImage>
      </figure>

      <dl className="mx-5 mt-3">
        <Row label="Etkinlik">{`${eventName} · ${eventTime}`}</Row>
        {sale ? <Row label="Seçim">{selectionText(table, sale.pick)}</Row> : null}
        {sale && sale.otherPicks.length > 0 ? <Row label="Diğer seçimler">{sale.otherPicks.join(" / ")}</Row> : null}
        {unitPrice ? <Row label="Kişi Başı Fiyat">{formatMoney(unitPrice, currency)}</Row> : null}
        {sale && hasPicks && sale.total !== null ? (
          <Row label="Toplam Tutar" strong>
            {formatMoney(sale.total, currency)}
          </Row>
        ) : null}
      </dl>

      {sale && table.status === "available" ? (
        <div className="mx-5 mt-3">
          <ActiveTableCard
            compact
            table={table}
            pick={sale.pick}
            unitPrice={unitPrice}
            currency={currency}
            disabled={sale.pending}
            onToggleSeat={sale.onToggleSeat}
            onToggleWhole={sale.onToggleWhole}
          />
        </div>
      ) : null}

      {children ? <div className="mx-5 mt-3 flex flex-col gap-2">{children}</div> : null}
      {sale && !sale.readiness.ready && sale.readiness.reason ? (
        <p className="mx-5 mt-3 text-sm text-muted">{sale.readiness.reason}</p>
      ) : null}
      {!sale && closedLabel ? <p className="mx-5 mt-3 text-sm font-semibold text-ivory">{closedLabel}</p> : null}

      <div className="flex flex-col gap-2 p-5 sm:flex-row sm:flex-wrap">
        {canLookIn3d ? (
          <Button variant="glass" className="sm:flex-1" onClick={onLookIn3d}>
            Masadan Sahneye Bak
          </Button>
        ) : null}
        {sale ? (
          <Button variant="gold" className="sm:flex-[2]" disabled={!canProceed} onClick={sale.onProceed}>
            {sale.pending ? "Yeriniz ayrılıyor…" : PROCEED_LABEL}
          </Button>
        ) : null}
        <Button variant="ghost" className="sm:flex-1" onClick={onClose}>
          Kapat
        </Button>
      </div>
    </div>
  );
}
