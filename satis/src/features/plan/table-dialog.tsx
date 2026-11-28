"use client";

import dynamic from "next/dynamic";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { SightlineSet } from "@/lib/core/contract";
import { formatMoney } from "@/lib/format";
import { ActiveTableCard } from "./active-table-card";
import { SceneBoundary } from "./plan-3d";
import type { PlanModel, PlanTableModel } from "./model";
import { PROCEED_LABEL, type Readiness, type TablePick } from "./picks";
import { resolveTableSightlineSrc } from "./sightline";
import { SightlineImage } from "./sightline-panel";

const TablePerspective = dynamic(() => import("./table-perspective"), { ssr: false });

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
  model: PlanModel;
  artworkUrl: string | null;
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
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-line py-2.5 last:border-b-0">
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
      {table ? <TableDialogBody key={table.id} titleId={titleId} table={table} {...rest} /> : null}
    </Modal>
  );
}

function TableDialogBody({
  titleId,
  table,
  model,
  artworkUrl,
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
  const [previewFailed, setPreviewFailed] = useState(false);
  const name = kindName(table);
  const sightlineImgSrc = resolveTableSightlineSrc(sightlineSet, { label: table.label, isLoca: table.isLoca });
  const canProceed = sale !== null && sale.readiness.ready && !sale.pending && sale.total !== null;
  const hasPicks = sale !== null && (sale.pick !== null || sale.otherPicks.length > 0);

  return (
    <div className="flex flex-col">
      <figure className="relative overflow-hidden bg-bg">
        <div className="relative aspect-video w-full">
          {canLookIn3d && !previewFailed ? (
            <div className="pointer-events-none absolute inset-0">
              <SceneBoundary onFail={() => setPreviewFailed(true)}>
                <TablePerspective model={model} tableId={table.id} title={eventName} artworkUrl={artworkUrl}
                  label={`${name} konumundan sahneye bakış`} onFail={() => setPreviewFailed(true)} />
              </SceneBoundary>
            </div>
          ) : (
            <SightlineImage src={sightlineImgSrc} alt={`${name} için kayıtlı sahne görünümü`}
              fallback="Bu konum için kayıtlı sahne görseli yok." />
          )}
          <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-bg to-transparent px-5 pt-8 pb-2 text-sm font-semibold text-ivory">
            {`${name} — Sahne Görünümü`}
          </figcaption>
        </div>
      </figure>
      <div className="px-5 pt-3">
        <Button variant="glass" className="w-full border-gold text-gold-bright" onClick={onLookIn3d} disabled={!canLookIn3d}>
          Masadan Sahneye Bak
        </Button>
      </div>
      <div className="px-5 pt-4">
        <h2 id={titleId} className="text-[28px] leading-tight text-ivory">{name}</h2>
        <p className="text-sm text-muted">{availabilityText(table)}</p>
      </div>
      <dl className="mx-5 mt-3">
        <Row label="Etkinlik">{`${eventName} · ${eventTime}`}</Row>
        {metrics ? <Row label="Sahneye mesafe ve açı">{metrics}</Row> : null}
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
        <details className="mx-5 mt-3 rounded-[14px] border border-line bg-surface-raised">
          <summary className="cursor-pointer px-4 py-2.5 text-xs font-semibold tracking-wider text-gold-bright uppercase select-none hover:text-ivory">
            Sandalyeleri değiştir
          </summary>
          <div className="border-t border-line p-3">
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
        </details>
      ) : null}

      {children ? <div className="mx-5 mt-3 flex flex-col gap-2">{children}</div> : null}
      {sale && !sale.readiness.ready && sale.readiness.reason ? (
        <p className="mx-5 mt-3 text-sm text-muted">{sale.readiness.reason}</p>
      ) : null}
      {!sale && closedLabel ? <p className="mx-5 mt-3 text-sm font-semibold text-ivory">{closedLabel}</p> : null}

      <div className="grid grid-cols-2 gap-2 p-5">
        <Button variant="gold" disabled={!canProceed} onClick={sale?.onProceed}>
          {sale?.pending ? "Yeriniz ayrılıyor…" : PROCEED_LABEL}
        </Button>
        <Button variant="ghost" className="sm:flex-1" onClick={onClose}>
          Kapat
        </Button>
      </div>
    </div>
  );
}
