import { cn } from "@/lib/utils";
import { DEMO_BADGE, orderStatusLabel } from "../view-model";

const BASE = "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap";

/** Durum rozeti: koyu zeminde 4.5:1'i aşan açık tonlar. */
const STATUS_TONES = {
  paid: "border-emerald-400/50 bg-emerald-500/15 text-emerald-300",
  pending: "border-amber-400/50 bg-amber-500/15 text-amber-300",
} as const;

export function OrderStatusBadge({ status, className }: { status: "pending" | "paid"; className?: string }) {
  return <span className={cn(BASE, STATUS_TONES[status], className)}>{orderStatusLabel(status)}</span>;
}

export function DemoBadge({ className }: { className?: string }) {
  return <span className={cn(BASE, "border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-200", className)}>{DEMO_BADGE}</span>;
}

/** Demo siparişin açıklama şeridi. */
export function DemoNotice({ text, className }: { text: string; className?: string }) {
  return (
    <p
      role="note"
      className={cn("rounded-md border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-2 text-sm text-fuchsia-100", className)}
    >
      {text}
    </p>
  );
}
