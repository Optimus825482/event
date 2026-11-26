import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-line bg-surface">
      <nav aria-label="Hukuki" className="mx-auto flex max-w-5xl flex-wrap gap-2 px-4 py-3">
        <Link href="/kvkk" className={buttonClass("ghost")}>
          KVKK
        </Link>
        <Link href="/mesafeli-satis" className={buttonClass("ghost")}>
          Mesafeli Satış
        </Link>
      </nav>
    </footer>
  );
}
