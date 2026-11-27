import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SiteTab } from "../tabs";

export function SiteTabs({
  eventId,
  active,
  canSeeOrders,
}: {
  eventId: string;
  active: SiteTab;
  canSeeOrders: boolean;
}) {
  const linkClass = (isActive: boolean) =>
    cn(
      "inline-flex min-h-10 items-center border-b-2 px-3 text-sm font-medium transition-colors",
      isActive
        ? "border-primary text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground",
    );

  return (
    <nav aria-label="Etkinlik satış sitesi sekmeleri" className="flex gap-2 border-b">
      <Link
        href={`/sales-site/${eventId}`}
        aria-current={active === "icerik" ? "page" : undefined}
        className={linkClass(active === "icerik")}
      >
        Site içeriği
      </Link>
      {canSeeOrders ? (
        <Link
          href={`/sales-site/${eventId}?tab=siparisler`}
          aria-current={active === "siparisler" ? "page" : undefined}
          className={linkClass(active === "siparisler")}
        >
          Siparişler
        </Link>
      ) : null}
    </nav>
  );
}
