import { CalendarCheck, Mail, NotebookPen, Phone, Search, Ticket } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/layout/empty-state";
import { buttonVariants } from "@/components/ui/button";
import type { CustomerList } from "../queries";
import { VIP_SCORE_THRESHOLD } from "../vip";
import { TagChips } from "./tag-chips";
import { APP_TIME_ZONE } from "@/lib/time-zone";

type Props = { list: CustomerList; basePath: string; q: string | undefined; showReservations: boolean };

const dateFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: APP_TIME_ZONE });

function pageHref(basePath: string, q: string | undefined, page: number): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Arama formu: düz GET, istemci kodu gerektirmez. */
export function SearchForm({ basePath, q }: { basePath: string; q: string | undefined }) {
  return (
    <form action={basePath} method="get" role="search" className="flex gap-2">
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Ad, telefon veya e-posta ara"
          aria-label="Müşteri ara"
          className="h-10 w-full rounded-lg border border-slate-700 bg-slate-800/50 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20"
        />
      </div>
      <button type="submit" className={buttonVariants({ variant: "secondary" })}>
        Ara
      </button>
    </form>
  );
}

export function Pagination({ list, basePath, q, noun = "müşteri" }: { list: CustomerList; basePath: string; q: string | undefined; noun?: string }) {
  return (
    <nav aria-label="Sayfalama" className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">
        {list.total} {noun}, sayfa {list.page}/{list.totalPages}
      </span>
      <span className="flex gap-2">
        {list.page > 1 ? (
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={pageHref(basePath, q, list.page - 1)}>
            Önceki
          </Link>
        ) : null}
        {list.page < list.totalPages ? (
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={pageHref(basePath, q, list.page + 1)}>
            Sonraki
          </Link>
        ) : null}
      </span>
    </nav>
  );
}

/** Müşteri kartları (eski CRM kart ızgarası): avatar, VIP/kara liste rozeti, iletişim, etiketler ve sayaçlar. */
export function CustomerList({ list, basePath, q, showReservations }: Props) {
  if (list.items.length === 0) {
    return <EmptyState title={q ? "Aramanızla eşleşen müşteri bulunamadı." : "Henüz müşteri yok."} />;
  }

  return (
    <div className="space-y-4">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.items.map((c) => {
          const isVip = c.vipScore >= VIP_SCORE_THRESHOLD || c.tags.some((t) => t.toLowerCase() === "vip");
          return (
            <li key={c.id} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 transition-colors hover:border-slate-600">
              <div className="flex items-start gap-3">
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-lg font-bold text-white"
                  aria-hidden
                >
                  {c.fullName.trim().charAt(0).toLocaleUpperCase("tr")}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <Link href={`/customers/${c.id}`} className="block truncate font-semibold text-white hover:underline">
                    {c.fullName}
                  </Link>
                  <div className="flex flex-wrap gap-1">
                    {isVip ? (
                      <span className="rounded border border-yellow-500/30 bg-yellow-600/20 px-2 py-0.5 text-xs font-medium text-yellow-400">
                        VIP
                      </span>
                    ) : null}
                    {c.isBlacklisted ? (
                      <span className="rounded border border-red-500/30 bg-red-600/20 px-2 py-0.5 text-xs font-medium text-red-400">
                        Kara liste
                      </span>
                    ) : null}
                    {c.noShowCount > 0 ? (
                      <span className="rounded border border-amber-500/30 bg-amber-600/20 px-2 py-0.5 text-xs text-amber-400">
                        {c.noShowCount} gelmedi
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <dl className="mt-3 space-y-1 text-sm text-slate-400">
                <div className="flex items-center gap-2">
                  <dt className="sr-only">Telefon</dt>
                  <Phone className="size-4 shrink-0" aria-hidden />
                  <dd>{c.phone ?? "-"}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="sr-only">E-posta</dt>
                  <Mail className="size-4 shrink-0" aria-hidden />
                  <dd className="truncate">{c.email ?? "-"}</dd>
                </div>
              </dl>
              <TagChips tags={c.tags} className="mt-3" />
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-700/60 pt-3 text-xs text-slate-400">
                {showReservations ? (
                  <span className="flex items-center gap-1">
                    <Ticket className="size-3.5" aria-hidden />
                    {c.reservationCount} rezervasyon
                  </span>
                ) : null}
                <span className="flex items-center gap-1">
                  <NotebookPen className="size-3.5" aria-hidden />
                  {c.noteCount} not
                </span>
                {c.lastEventAt ? (
                  <span className="flex items-center gap-1">
                    <CalendarCheck className="size-3.5" aria-hidden />
                    Son katılım {dateFormat.format(c.lastEventAt)}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <Pagination list={list} basePath={basePath} q={q} />
    </div>
  );
}
