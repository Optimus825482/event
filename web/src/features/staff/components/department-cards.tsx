import Link from "next/link";
import { Building2 } from "lucide-react";
import type { DepartmentCard } from "../overview-queries";

/** Bölüm kartları: her kart personel listesini o bölümle süzer. */
export function DepartmentCards({ cards, activeId }: { cards: DepartmentCard[]; activeId: string | undefined }) {
  if (cards.length === 0) return null;
  return (
    <section aria-label="Bölümler" className="mb-6">
      <h2 className="mb-3 text-sm font-medium text-slate-300">Bölümler</h2>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {cards.map((card) => {
          const selected = card.id !== null && card.id === activeId;
          const content = (
            <>
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${card.color ?? "#64748b"}33`, color: card.color ?? "#94a3b8" }}
              >
                <Building2 className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-white">{card.name}</span>
                <span className="block text-xs text-slate-400">
                  {card.activeCount} aktif · {card.totalCount} toplam
                </span>
              </span>
            </>
          );
          const base = "flex items-center gap-3 rounded-xl border p-3 transition-colors";
          return (
            <li key={card.id ?? "none"}>
              {card.id === null ? (
                <div className={`${base} border-slate-700 bg-slate-800/30`}>{content}</div>
              ) : (
                <Link
                  href={selected ? "/staff" : `/staff?departmentId=${card.id}`}
                  aria-current={selected ? "true" : undefined}
                  className={`${base} focus-visible:outline-2 ${
                    selected
                      ? "border-blue-500/50 bg-blue-500/10"
                      : "border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800"
                  }`}
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
