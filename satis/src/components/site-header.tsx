import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SITE_NAME } from "@/content/site";

export function SiteHeader() {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4 px-[clamp(16px,4vw,44px)] py-3.5">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-[13.5px] font-bold uppercase tracking-[0.2em] text-gold-bright no-underline"
        >
          {SITE_NAME}
        </Link>
        <SiteNav />
      </div>
    </header>
  );
}
