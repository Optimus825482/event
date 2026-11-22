import { Calendar, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer } from "@/components/ui/PageContainer";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { groupBoard, parseBoardTab } from "@/features/events/board";
import { EventBoard } from "@/features/events/components/event-board";
import { loadEventBoard } from "@/features/events/queries";

export const metadata: Metadata = { title: "Etkinlikler | EventFlow" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function EventsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const tab = parseBoardTab(first(sp.tab));
  const search = first(sp.search)?.trim() || undefined;
  const board = await loadEventBoard(search);
  const now = new Date();
  const groups = groupBoard(board.items, now);

  return (
    <PageContainer>
      <PageHeader
        title="Etkinlikler"
        description="Etkinliklerinizi planlayın, hazırlık durumunu izleyin"
        icon={<Calendar className="h-8 w-8 text-blue-400" aria-hidden />}
        actions={
          <form role="search" className="flex items-center gap-2">
            <input type="hidden" name="tab" value={tab} />
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
              <input
                name="search"
                defaultValue={search ?? ""}
                placeholder="Etkinlik ara"
                aria-label="Etkinlik ara"
                className="w-56 rounded-md border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>
            <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "border-slate-600 bg-transparent")}>
              Ara
            </button>
            {board.canCreate ? (
              <Link href="/events/new" className={buttonVariants()}>
                Adım adım oluştur
              </Link>
            ) : null}
          </form>
        }
      />
      <EventBoard
        groups={groups}
        activeTab={tab}
        search={search}
        now={now}
        canCreate={board.canCreate}
        canEdit={board.canEdit}
        canDelete={board.canDelete}
      />
    </PageContainer>
  );
}
