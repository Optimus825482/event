import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { PublicPlan } from "@/features/find-table/components/public-plan";
import { FIND_TABLE_METADATA } from "@/features/find-table/page-meta";
import { getPublicTableView } from "@/features/find-table/public";
import Link from "next/link";

export const metadata = FIND_TABLE_METADATA;
export const dynamic = "force-dynamic";

export default async function MyTablePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await getPublicTableView(db, token);
  if (!view) notFound();

  const single = view.tables.length === 1;
  const list = single
    ? view.tables[0]!.label
    : view.tables.map((t) => `${t.label} (${t.seats} kişi)`).join(", ");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 bg-background p-4 text-foreground">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{view.eventName}</h1>
        <p className="text-sm text-muted-foreground">{view.eventDate}</p>
      </header>
      <p className="text-lg font-medium">
        {single ? "Masanız" : "Masalarınız"}: {list}
      </p>
      <PublicPlan plan={view.plan} highlightIds={view.tables.map((t) => t.id)} ariaLabel="Salon planı" />
      <Link href="/masam" className="text-sm text-foreground underline underline-offset-4">
        Başka bir kodla ara
      </Link>
    </main>
  );
}
