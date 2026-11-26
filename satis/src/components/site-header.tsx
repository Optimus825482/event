import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2">
        <Link
          href="/"
          className={cn("inline-flex min-h-11 items-center font-serif text-lg font-semibold text-gold no-underline")}
        >
          Merit Royal Bilet
        </Link>
        <Link href="/biletimi-bul" className={buttonClass("ghost")}>
          Biletimi bul
        </Link>
      </div>
    </header>
  );
}
