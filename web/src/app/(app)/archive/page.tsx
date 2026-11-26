import { Archive } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/db/client";
import { ArchiveTable } from "@/features/archive/components/archive-table";
import { listArchives } from "@/features/archive/read";
import { requirePolicyActor } from "@/features/auth/permissions";

export const metadata: Metadata = { title: "Arşiv | EventFlow" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const MAX_PAGE = 1_000_000;

function pageHref(q: string | undefined, page: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/archive?${qs}` : "/archive";
}

export default async function ArchivePage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePolicyActor();
  const params = await searchParams;
  const q = first(params.q)?.trim() || undefined;
  const parsedPage = Number(first(params.page));
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 && parsedPage <= MAX_PAGE ? parsedPage : 1;
  const list = await listArchives(db, actor, { search: q, page });
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Arşiv"
        description="Tamamlanan etkinliklerin anlık görüntüsü"
        icon={<Archive className="size-8 text-blue-400" aria-hidden />}
      />
      <form action="/archive" method="get" role="search" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Etkinlik veya sanatçı ara"
          aria-label="Arşivde ara"
          className="h-10 w-full max-w-md rounded-lg border border-slate-500 bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/40"
        />
        <button type="submit" className={buttonVariants({ variant: "secondary" })}>
          Ara
        </button>
      </form>
      {list.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {q ? "Aramayla eşleşen arşiv kaydı yok." : "Henüz arşivlenmiş etkinlik yok. Etkinlik tamamlandığında burada görünür."}
        </p>
      ) : (
        <>
          <ArchiveTable items={list.items} caption="Arşivlenmiş etkinlikler" />
          <nav aria-label="Sayfalama" className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {list.total} kayıt, sayfa {list.page}/{totalPages}
            </span>
            <span className="flex gap-2">
              {list.page > 1 ? (
                <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={pageHref(q, list.page - 1)}>
                  Önceki
                </Link>
              ) : null}
              {list.page < totalPages ? (
                <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={pageHref(q, list.page + 1)}>
                  Sonraki
                </Link>
              ) : null}
            </span>
          </nav>
        </>
      )}
    </div>
  );
}
