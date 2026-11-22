import type { ReservationStatus } from "@/domain/reservation-status";
import { cn } from "@/lib/utils";
import { RESERVATION_STATUS_LABELS } from "../labels";

/** Eski arayüzün durum renkleri: onaylı yeşil, bekleyen sarı, iptal kırmızı, giriş mavi, gelmedi gri. */
const STATUS_TONES: Record<ReservationStatus, string> = {
  confirmed: "border-emerald-500/30 bg-emerald-500/20 text-emerald-400",
  pending: "border-amber-500/30 bg-amber-500/20 text-amber-400",
  cancelled: "border-red-500/30 bg-red-500/20 text-red-400",
  checked_in: "border-blue-500/30 bg-blue-500/20 text-blue-400",
  no_show: "border-slate-500/30 bg-slate-500/20 text-slate-400",
};

export function ReservationStatusBadge({ status, className }: { status: ReservationStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", STATUS_TONES[status], className)}>
      {RESERVATION_STATUS_LABELS[status]}
    </span>
  );
}
