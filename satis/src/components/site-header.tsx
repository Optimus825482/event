import { BrandLogoLink } from "@/components/brand-logo";
import { SiteNav } from "@/components/site-nav";

export function SiteHeader() {
  return (
    <header className="no-print sticky top-0 z-50 border-b border-line bg-bg/90 backdrop-blur-md">
      <div className="flex w-full items-center justify-between gap-4 px-[clamp(16px,4vw,44px)] py-3.5">
        <BrandLogoLink />
        <SiteNav />
      </div>
    </header>
  );
}
