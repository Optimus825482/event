import Link from "next/link";
import { BRAND_LOGO } from "@/content/site";
import { cn } from "@/lib/cn";

/** Ana sayfaya giden altın logo; görsel süs sayılır, bağlantının adı erişilebilir addır. */
export function BrandLogoLink({ className, imageClassName }: { className?: string; imageClassName?: string }) {
  return (
    <Link
      href="/"
      aria-label={BRAND_LOGO.homeLabel}
      className={cn("inline-flex min-h-11 items-center no-underline", className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- vektör logo public/brand/ altından doğrudan sunulur */}
      <img
        src={BRAND_LOGO.src}
        alt=""
        width={BRAND_LOGO.width}
        height={BRAND_LOGO.height}
        decoding="async"
        className={cn("block h-[46px] w-auto", imageClassName)}
      />
    </Link>
  );
}
