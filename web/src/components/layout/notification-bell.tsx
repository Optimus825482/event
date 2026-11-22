import { Bell } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Okunmamış sayısı sunucuda hesaplanır (bkz. `(app)/layout.tsx`); gezinmede tazelenir. */
export function NotificationBell({ unread, className }: { unread: number; className?: string }) {
  const label = unread > 0 ? `Bildirimler, ${unread} okunmamış` : "Bildirimler";
  return (
    <Link
      href="/notifications"
      aria-label={label}
      className={cn(
        "relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white",
        className,
      )}
    >
      <Bell aria-hidden="true" className="h-5 w-5" />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
