import { Calendar, Clock, Search, Ticket, UserCheck } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { can } from "@/features/auth/policy";
import { ReservationEventCard } from "@/features/reservations/components/event-card";
import { ReservationsHero } from "@/features/reservations/components/reservations-hero";
import { loadReservationDashboard } from "@/features/reservations/queries";

export const metadata: Metadata = { title: "Rezervasyonlar | EventFlow" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function ReservationsDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const { actor, search, items, todayCount } = await loadReservationDashboard({
    search: first(sp.search),
  });
  const next = items[0];
  const others = items.slice(1);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8 md:space-y-8">
      <PageHeader
        title="Rezervasyonlar"
        description="Rezervasyonlarını yönetmek için bir etkinlik seçin."
        icon={<Ticket className="size-8 text-purple-400" />}
      />

      {next && !search ? (
        <ReservationsHero
          event={next}
          canCheckIn={can(actor, "check_in", "view")}
        />
      ) : search ? null : (
        <EmptyState
          icon={<Calendar />}
          title="Yaklaşan etkinlik bulunmuyor"
          description="Yayınlanan etkinlikler burada görünür."
        />
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard
          tone="purple"
          icon={<Calendar className="size-5" />}
          value={items.length}
          label="Yaklaşan Etkinlik"
        />
        <StatCard
          tone="amber"
          icon={<Clock className="size-5" />}
          value={todayCount}
          label="Bugün"
        />
        <StatCard
          tone="emerald"
          icon={<UserCheck className="size-5" />}
          value={next?.checkedInCount ?? 0}
          label="Check-in"
          className="col-span-2 md:col-span-1"
        />
      </div>

      {items.length > 1 || search ? (
        <section className="space-y-4" aria-labelledby="all-events">
          <div className="flex items-center justify-between px-1">
            <h2
              id="all-events"
              className="text-base font-semibold tracking-wide text-white md:text-lg"
            >
              Tüm Yaklaşan Etkinlikler
            </h2>
            <span className="rounded-full border border-purple-500/30 px-3 py-1 text-sm text-purple-300">
              {items.length}
            </span>
          </div>

          <form className="flex flex-wrap gap-2" role="search">
            <div className="relative min-w-64 flex-1">
              <Search
                className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-500"
                aria-hidden
              />
              <input
                name="search"
                defaultValue={search ?? ""}
                placeholder="Etkinlik ara..."
                aria-label="Etkinlik ara"
                className="h-12 w-full rounded-2xl border border-slate-700/50 bg-slate-800/50 pl-12 pr-4 text-base text-white placeholder:text-slate-500 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
            <button
              type="submit"
              className={buttonVariants({
                variant: "outline",
                className: "h-12",
              })}
            >
              Ara
            </button>
          </form>

          {items.length === 0 ? (
            <EmptyState
              title={
                search ? "Etkinlik bulunamadı" : "Yaklaşan etkinlik bulunmuyor"
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {(search ? items : others).map((event) => (
                <ReservationEventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
