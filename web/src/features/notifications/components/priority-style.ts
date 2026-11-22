import { AlertOctagon, AlertTriangle, Bell, Info, type LucideIcon } from "lucide-react";
import type { NotificationRow } from "../service";

export type PriorityStyle = { icon: LucideIcon; tile: string; badge: string; unreadCard: string };

/** Eski arayüzdeki öncelik renkleri: düşük gri, orta mavi, yüksek turuncu, acil kırmızı. */
export const PRIORITY_STYLES: Record<NotificationRow["priority"], PriorityStyle> = {
  low: {
    icon: Info,
    tile: "bg-slate-700/50 text-slate-300",
    badge: "border-slate-600 bg-slate-700/50 text-slate-300",
    unreadCard: "border-slate-500/50 bg-slate-800",
  },
  medium: {
    icon: Bell,
    tile: "bg-blue-500/20 text-blue-400",
    badge: "border-blue-500/30 bg-blue-500/20 text-blue-300",
    unreadCard: "border-blue-500/40 bg-blue-500/5",
  },
  high: {
    icon: AlertTriangle,
    tile: "bg-amber-500/20 text-amber-400",
    badge: "border-amber-500/30 bg-amber-500/20 text-amber-300",
    unreadCard: "border-amber-500/40 bg-amber-500/5",
  },
  urgent: {
    icon: AlertOctagon,
    tile: "bg-red-500/20 text-red-400",
    badge: "border-red-500/30 bg-red-500/20 text-red-300",
    unreadCard: "border-red-500/40 bg-red-500/5",
  },
};

export const READ_CARD = "border-slate-700 bg-slate-800/50";
