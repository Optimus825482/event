import { Music } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { listArtistComparison } from "@/features/artists/comparison";
import { ArtistForm } from "@/features/artists/components/artist-form";
import { ArtistTable } from "@/features/artists/components/artist-table";

export const metadata: Metadata = { title: "Sanatçılar | EventFlow" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ArtistsPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePolicyActor();
  const params = await searchParams;
  const q = first(params.q)?.trim() || undefined;
  const includeInactive = first(params.inactive) === "1";
  const rows = await listArtistComparison(db, actor, { search: q, includeInactive });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Sanatçılar" description="Sanatçı karşılaştırması" icon={<Music className="size-8 text-blue-400" aria-hidden />} />
      <form action="/artists" method="get" role="search" className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Sanatçı ara"
          aria-label="Sanatçı ara"
          className="h-10 w-full max-w-md rounded-lg border border-slate-500 bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/40"
        />
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" name="inactive" value="1" defaultChecked={includeInactive} className="size-4 accent-blue-600" />
          Pasifleri göster
        </label>
        <button type="submit" className={buttonVariants({ variant: "secondary" })}>
          Ara
        </button>
      </form>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Sanatçı bulunamadı.</p> : <ArtistTable rows={rows} />}
      {can(actor, "archive", "create") ? (
        <section aria-labelledby="new-artist" className="space-y-3 rounded-xl border border-slate-500 bg-card p-5 text-card-foreground">
          <h2 id="new-artist" className="text-lg font-medium text-foreground">
            Yeni sanatçı
          </h2>
          <ArtistForm />
        </section>
      ) : null}
    </div>
  );
}
