"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { openTicketDialog } from "@/components/event/ticket-dialog";
import { buttonClass } from "@/components/ui/button";
import { isCurrentPath, NAV_CTA, NAV_ITEMS } from "@/content/site";
import { cn } from "@/lib/cn";

export function SiteNav(): React.JSX.Element {
  const pathname = usePathname() ?? "/";
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (detailsRef.current) detailsRef.current.open = false;
  }, [pathname]);

  // Etkinlik sayfasında "Bilet Al" kişi sayısı penceresini açar; pencere yoksa (satış kapalı, başka sayfa) etkinliklere gider.
  function handleCta(event: React.MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (!openTicketDialog()) return;
    event.preventDefault();
    if (detailsRef.current) detailsRef.current.open = false;
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDetailsElement>) {
    if (event.key === "Escape" && detailsRef.current) {
      detailsRef.current.open = false;
    }
  }

  return (
    <nav aria-label="Ana menü" className="flex items-center">
      <div data-nav="desktop" className="hidden items-center gap-5 min-[860px]:flex">
        {NAV_ITEMS.map((item) => {
          const active = isCurrentPath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center text-[13.5px] font-medium no-underline transition-colors hover:text-ivory",
                active ? "text-ivory" : "text-muted",
              )}
            >
              {item.label}
            </Link>
          );
        })}
        <Link href={NAV_CTA.href} onClick={handleCta} className={buttonClass("gold")}>
          {NAV_CTA.label}
        </Link>
      </div>

      <details ref={detailsRef} data-nav="mobile" className="relative min-[860px]:hidden" onKeyDown={handleKeyDown}>
        <summary className="inline-flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-full border border-line-gold px-4 text-sm font-semibold text-ivory hover:border-gold hover:bg-glass">
          Menü
        </summary>
        <div className="absolute right-0 top-full z-50 mt-2 flex w-64 flex-col gap-1 rounded-[16px] border border-line-gold bg-surface p-3 shadow-xl">
          {NAV_ITEMS.map((item) => {
            const active = isCurrentPath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-[12px] px-3 text-sm font-medium no-underline transition-colors hover:bg-surface-raised hover:text-ivory",
                  active ? "bg-surface-raised text-ivory" : "text-muted",
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <Link href={NAV_CTA.href} onClick={handleCta} className={cn(buttonClass("gold"), "mt-2 w-full")}>
            {NAV_CTA.label}
          </Link>
        </div>
      </details>
    </nav>
  );
}
