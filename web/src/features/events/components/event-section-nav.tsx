import Link from "next/link";
import { cn } from "@/lib/utils";
import type { EventSection, EventSectionKey } from "../sections";

/**
 * Etkinlik bölüm çubuğu. `href` bir işlev olduğundan istemciye geçirilemez; sunucu bileşenidir.
 * Görünür bölüm 2'den azsa çizilmez. Dar ekranda çubuk kendi içinde yatay kaydırılır.
 */
export function EventSectionNav({
  eventId,
  sections,
  active,
}: {
  eventId: string;
  sections: EventSection[];
  active: EventSectionKey;
}) {
  if (sections.length < 2) return null;
  return (
    <nav aria-label="Etkinlik bölümleri" className="max-w-full overflow-x-auto border-b border-border">
      <ul className="flex w-max min-w-full gap-1">
        {sections.map((section) => {
          const current = section.key === active;
          return (
            <li key={section.key}>
              <Link
                href={section.href(eventId)}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "-mb-px block whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  current
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
