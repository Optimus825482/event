import { BrandLogoLink } from "@/components/brand-logo";
import { SiteNav } from "@/components/site-nav";

export function SiteHeader() {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4 px-[clamp(16px,4vw,44px)] py-2.5">
        <BrandLogoLink />
        <SiteNav />
      </div>
    </header>
  );
}
