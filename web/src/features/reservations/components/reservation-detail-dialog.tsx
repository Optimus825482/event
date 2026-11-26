"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ReservationStatus } from "@/domain/reservation-status";
import { ReservationStatusBadge } from "./status-badge";

export type ReservationRowData = {
  id: string;
  bookingCode: string;
  status: ReservationStatus;
  guestName: string | null;
  customerName: string | null;
  guestPhone: string | null;
  guestEmail: string | null;
  tableLabel: string;
  tableCapacity: number;
  guestCount: number;
  specialRequests: string | null;
  isBlacklisted: boolean;
};

export function displayName(row: Pick<ReservationRowData, "guestName" | "customerName">): string {
  return row.guestName ?? row.customerName ?? "Misafir";
}

/** Hızlı bakış penceresi (eski `ReservationDetailPanel`): ad, iletişim, masa, kişi ve durum. */
export function ReservationDetailDialog({
  eventId,
  row,
  onClose,
}: {
  eventId: string;
  row: ReservationRowData | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={row !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        {row ? (
          <>
            <DialogHeader>
              <DialogTitle>Rezervasyon özeti</DialogTitle>
            </DialogHeader>
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Ad Soyad</dt>
              <dd className="font-medium">{displayName(row)}</dd>
              <dt className="text-muted-foreground">Telefon</dt>
              <dd>{row.guestPhone ?? "-"}</dd>
              <dt className="text-muted-foreground">E-posta</dt>
              <dd className="break-all">{row.guestEmail ?? "-"}</dd>
              <dt className="text-muted-foreground">Masa</dt>
              <dd>{row.tableLabel}</dd>
              <dt className="text-muted-foreground">Kişi</dt>
              <dd>
                {row.guestCount} / {row.tableCapacity}
              </dd>
              <dt className="text-muted-foreground">Durum</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <ReservationStatusBadge status={row.status} />
                {row.isBlacklisted ? <span className="text-xs text-destructive">Kara listede</span> : null}
              </dd>
              {row.specialRequests ? (
                <>
                  <dt className="text-muted-foreground">Özel istek</dt>
                  <dd className="whitespace-pre-wrap">{row.specialRequests}</dd>
                </>
              ) : null}
            </dl>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Kapat
              </Button>
              <Button asChild>
                <Link href={`/reservations/${eventId}/${row.id}`}>QR / Ayrıntı sayfası</Link>
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
