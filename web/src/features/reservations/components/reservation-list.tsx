"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useRunAction } from "@/features/customers/components/use-run-action";
import { bulkCancelReservationsAction } from "../actions";
import { displayName, ReservationDetailDialog, type ReservationRowData } from "./reservation-detail-dialog";
import { ReservationStatusActions } from "./status-actions";
import { ReservationStatusBadge } from "./status-badge";

type Props = {
  eventId: string;
  items: ReservationRowData[];
  canEdit: boolean;
  canOverrideBlacklist: boolean;
};

const cancellable = (row: ReservationRowData) => row.status === "pending" || row.status === "confirmed";

/** Liste: durum rozetleri, çoklu seçim + "Toplu İptal", özet penceresi ve satır işlemleri. */
export function ReservationList({ eventId, items, canEdit, canOverrideBlacklist }: Props) {
  const router = useRouter();
  const { pending, failure, run, clear } = useRunAction();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [detail, setDetail] = useState<ReservationRowData | null>(null);

  const selectable = canEdit ? items.filter(cancellable) : [];
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id));

  function toggle(id: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  }

  function bulkCancel() {
    const ids = [...selected];
    run(
      bulkCancelReservationsAction,
      { ids },
      () => {
        setConfirmOpen(false);
        setSelected(new Set());
        router.refresh();
      },
      `${ids.length} rezervasyon iptal edildi`,
    );
  }

  return (
    <div className="space-y-3">
      {canEdit && selected.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <span className="text-sm text-red-200">{selected.size} rezervasyon seçildi</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Seçimi temizle
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setConfirmOpen(true)}>
              Toplu İptal ({selected.size})
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800/40">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/80 text-left text-slate-300">
            <tr>
              {canEdit ? (
                <th className="w-10 p-3">
                  <Checkbox
                    aria-label="Tümünü seç"
                    disabled={selectable.length === 0}
                    checked={allSelected}
                    onCheckedChange={(on) => setSelected(on === true ? new Set(selectable.map((r) => r.id)) : new Set())}
                  />
                </th>
              ) : null}
              <th className="p-3 font-medium">Misafir</th>
              <th className="p-3 font-medium">Masa</th>
              <th className="p-3 font-medium">Kişi</th>
              <th className="p-3 font-medium">Durum</th>
              <th className="p-3 font-medium">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60">
            {items.map((r) => (
              <tr key={r.id} className={selected.has(r.id) ? "bg-purple-500/10" : "hover:bg-slate-800/60"}>
                {canEdit ? (
                  <td className="p-3">
                    {cancellable(r) ? (
                      <Checkbox
                        aria-label={`${displayName(r)} rezervasyonunu seç`}
                        checked={selected.has(r.id)}
                        onCheckedChange={(on) => toggle(r.id, on === true)}
                      />
                    ) : null}
                  </td>
                ) : null}
                <td className="p-3">
                  <Link href={`/reservations/${eventId}/${r.id}`} className="font-medium text-white hover:underline">
                    {displayName(r)}
                  </Link>
                  <div className="mt-0.5 text-xs text-slate-300">
                    Kod: <span className="select-all font-mono tracking-wider">{r.bookingCode}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {r.guestPhone ?? ""}
                    {r.isBlacklisted ? <span className="ml-2 text-red-400">Kara listede</span> : null}
                  </div>
                </td>
                <td className="p-3">{r.tableLabel}</td>
                <td className="p-3">
                  {r.guestCount} / {r.tableCapacity}
                </td>
                <td className="p-3">
                  <ReservationStatusBadge status={r.status} />
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>
                      Özet
                    </Button>
                    <Link
                      href={`/reservations/${eventId}/${r.id}`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      QR / Ayrıntı
                    </Link>
                    <ReservationStatusActions
                      id={r.id}
                      status={r.status}
                      canEdit={canEdit}
                      canOverrideBlacklist={canOverrideBlacklist}
                      isBlacklisted={r.isBlacklisted}
                      compact
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ReservationDetailDialog eventId={eventId} row={detail} onClose={() => setDetail(null)} />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) clear();
        }}
        title="Seçili rezervasyonlar iptal edilsin mi?"
        description={`${selected.size} rezervasyon iptal edilecek ve masaları boşa çıkacak. Bu işlem geri alınamaz.${failure ? ` Hata: ${failure.message}` : ""}`}
        confirmText="Toplu İptal"
        cancelText="Vazgeç"
        variant="destructive"
        loading={pending}
        onConfirm={bulkCancel}
      />
    </div>
  );
}
