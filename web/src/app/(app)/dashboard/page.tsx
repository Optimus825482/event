import {
  ArrowRight,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  LayoutGrid,
  MapPin,
  Sparkles,
  Timer,
  Users,
  UsersRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Countdown } from "@/components/dashboard/countdown";
import { StatCard } from "@/components/layout/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { loadEventsDashboard } from "@/features/dashboard/queries";
import { APP_TIME_ZONE } from "@/lib/time-zone";

export const metadata: Metadata = { title: "Etkinlik Planlama | EventFlow" };

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: APP_TIME_ZONE,
});

function LinkCard({
  href,
  icon,
  title,
  hover,
  children,
}: {
  href?: string;
  icon: ReactNode;
  title: string;
  hover: string;
  children: ReactNode;
}) {
  const body = (
    <>
      <div className="mb-4 flex items-center justify-between">
        {icon}
        {href && <ArrowRight aria-hidden="true" className="h-5 w-5 text-slate-500" />}
      </div>
      <h2 className="mb-1 text-lg font-semibold text-white">{title}</h2>
      <div className="text-sm text-slate-400">{children}</div>
    </>
  );
  const base = `rounded-xl border border-slate-700 bg-slate-800/50 p-5 transition-colors ${hover}`;
  return href ? (
    <Link href={href} className={`block ${base}`}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}

export default async function EventsDashboardPage() {
  const [actor, data] = await Promise.all([requirePolicyActor(), loadEventsDashboard()]);
  const canStaff = can(actor, "staff", "view");
  const canVenues = can(actor, "venues", "view");

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="py-4 text-center">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold text-white">
          <Sparkles aria-hidden="true" className="h-6 w-6 text-amber-400" />
          EventFlow PRO Dashboard
        </h1>
        <p className="mt-1 text-slate-400">Etkinlik planlama ve yönetim merkezi</p>
      </div>

      {data.upcoming.length > 0 && (
        <section aria-label="Yaklaşan etkinlikler" className="space-y-3">
          {data.upcoming.map((event) => (
            <article
              key={event.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-500/30 bg-linear-to-r from-emerald-600/10 via-teal-600/10 to-cyan-600/10 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20">
                  <Timer aria-hidden="true" className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">{event.name}</h2>
                  <p className="text-xs text-slate-400">{dateFormat.format(event.startsAt)}</p>
                </div>
              </div>
              <Countdown target={event.startsAt.toISOString()} />
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
                  <MapPin aria-hidden="true" className="h-3 w-3" />
                  Yerleşim
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
                  <Users aria-hidden="true" className="h-3 w-3" />
                  Ekip
                </span>
                <Link href={`/events/${event.id}`} className={buttonVariants({ size: "sm" })}>
                  Detaylar
                  <ArrowRight aria-hidden="true" className="ml-1 h-3 w-3" />
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Toplam Etkinlik" value={data.totalEvents} tone="blue" icon={<Calendar aria-hidden="true" className="h-6 w-6" />} />
        <StatCard label="Tamamlanan" value={data.completedEvents} tone="emerald" icon={<CheckCircle2 aria-hidden="true" className="h-6 w-6" />} />
        <StatCard label="Yaklaşan" value={data.upcomingEvents} tone="amber" icon={<CalendarCheck aria-hidden="true" className="h-6 w-6" />} />
      </div>

      {(canStaff || canVenues) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {canStaff && (
            <LinkCard
              href="/staff"
              title="Ekip Yönetimi"
              hover="hover:border-purple-500/50"
              icon={
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20">
                  <UsersRound aria-hidden="true" className="h-6 w-6 text-purple-400" />
                </div>
              }
            >
              <span className="mr-4">
                <span className="font-bold text-purple-400">{data.totalStaff}</span> Personel
              </span>
              <span>
                <span className="font-bold text-purple-400">{data.totalTeams}</span> Ekip
              </span>
            </LinkCard>
          )}
          {canVenues && (
            <LinkCard
              href="/venues"
              title="Yerleşim Şablonları"
              hover="hover:border-green-500/50"
              icon={
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/20">
                  <MapPin aria-hidden="true" className="h-6 w-6 text-green-400" />
                </div>
              }
            >
              <span className="font-bold text-green-400">{data.venueTemplates}</span> şablon kayıtlı
            </LinkCard>
          )}
          {canStaff && (
            <LinkCard
              title="Ekip Atama Şablonları"
              hover="hover:border-amber-500/50"
              icon={
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20">
                  <LayoutGrid aria-hidden="true" className="h-6 w-6 text-amber-400" />
                </div>
              }
            >
              <span className="font-bold text-amber-400">{data.organizationTemplates}</span> şablon kayıtlı
            </LinkCard>
          )}
        </div>
      )}

      <nav aria-label="Hızlı erişim" className="flex flex-wrap items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-800/30 p-4">
        {can(actor, "events", "create") && (
          <Link href="/events/new" className={cn(buttonVariants({ variant: "outline" }), "border-blue-500/30 text-blue-400 hover:bg-blue-500/10")}>
            <Calendar aria-hidden="true" className="mr-2 h-4 w-4" />
            Yeni Etkinlik
          </Link>
        )}
        {canStaff && (
          <Link href="/staff" className={cn(buttonVariants({ variant: "outline" }), "border-purple-500/30 text-purple-400 hover:bg-purple-500/10")}>
            <Users aria-hidden="true" className="mr-2 h-4 w-4" />
            Ekip Yönetimi
          </Link>
        )}
        {canVenues && (
          <Link href="/venues" className={cn(buttonVariants({ variant: "outline" }), "border-green-500/30 text-green-400 hover:bg-green-500/10")}>
            <LayoutGrid aria-hidden="true" className="mr-2 h-4 w-4" />
            Şablonlar
          </Link>
        )}
      </nav>
    </div>
  );
}
