import { ArrowLeft, Map as MapIcon, MapPin, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { loadCheckInPlan } from "@/features/check-in/plan-queries";
import { RESERVATION_STATUS_LABELS } from "@/features/reservations/labels";
import { FloorPlanSwitcher } from "@/features/venue/components/floor-plan-switcher";

export const metadata: Metadata = { title: "Alan planı | EventFlow" };

type Params = Promise<{ eventId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CheckInPlanPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { eventId } = await params;
  const sp = await searchParams;
  const masa = first(sp.masa);
  const { plan, statuses, focus } = await loadCheckInPlan(eventId, masa);

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href={`/check-in/${eventId}`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Kapı girişine dön
      </Link>
      <PageHeader
        title="Alan planı"
        description={plan.eventName}
        icon={
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
            <MapIcon className="h-5 w-5" aria-hidden="true" />
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <FloorPlanSwitcher
          plan={plan}
          statuses={statuses}
          selectedId={focus?.table.id ?? null}
          height={520}
          ariaLabel={`${plan.eventName} alan planı`}
        />
        <aside aria-label="Masa ayrıntısı" className="space-y-3">
          {focus ? (
            <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="flex items-center gap-2 text-sm text-emerald-300">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                Seçili masa
              </p>
              <p className="text-3xl font-bold text-white">Masa {focus.table.label}</p>
              <p className="flex items-center gap-2 text-sm text-slate-300">
                <Users className="h-4 w-4" aria-hidden="true" />
                {focus.table.capacity} kişilik{focus.table.isLoca ? " · Loca" : ""}
              </p>
              {focus.guests.length === 0 ? (
                <p className="text-sm text-slate-400">Bu masada rezervasyon yok.</p>
              ) : (
                <ul className="space-y-2">
                  {focus.guests.map((g) => (
                    <li key={g.reservationId} className="rounded-lg bg-slate-900/60 p-2 text-sm">
                      <p className="font-medium text-white">{g.guestName}</p>
                      <p className="text-slate-400">
                        {g.guestCount} kişi · {RESERVATION_STATUS_LABELS[g.status]}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 text-sm text-slate-400">
              {masa ? `"${masa}" masası bu planda bulunamadı.` : "Masa aramak için plandaki arama kutusunu kullanın."}
            </div>
          )}
          <p className="text-xs text-slate-500">
            Renkler: yeşil boş, turuncu beklemede, kırmızı onaylı, mavi giriş yapıldı.
          </p>
        </aside>
      </div>
    </div>
  );
}
