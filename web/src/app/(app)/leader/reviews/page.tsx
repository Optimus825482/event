import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ClipboardCheck, Clock, Percent } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { formatDateTime, LeaderStat } from "@/features/reviews/components/leader-ui";
import { listReviewableEvents } from "@/features/reviews/queries";

export const metadata: Metadata = { title: "Değerlendirmeler | EventFlow" };

export default async function ReviewsPage() {
  const actor = await requirePolicyActor();
  const events = await listReviewableEvents(db, actor);

  const memberTotal = events.reduce((sum, e) => sum + e.memberCount, 0);
  const reviewed = events.reduce((sum, e) => sum + e.completedCount, 0);
  const done = events.filter((e) => e.memberCount > 0 && e.completedCount >= e.memberCount).length;
  const pending = events.filter((e) => e.reviewEnabled && e.completedCount < e.memberCount).length;
  const percent = memberTotal === 0 ? 0 : Math.round((reviewed / memberTotal) * 100);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Değerlendirmeler"
        description="Ekibinizin görev aldığı etkinlikler. Bir etkinliği seçip ekip üyelerini değerlendirin."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <LeaderStat label="Bekleyen Etkinlik" value={pending} icon={<Clock className="size-5" />} />
        <LeaderStat label="Tamamlanan" value={done} icon={<CheckCircle2 className="size-5" />} />
        <LeaderStat label="Değerlendirilen" value={reviewed} icon={<ClipboardCheck className="size-5" />} />
        <LeaderStat label="Tamamlanma" value={`%${percent}`} icon={<Percent className="size-5" />} />
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="Değerlendirilecek etkinlik yok"
          description="Değerlendirilecek ekip üyesi olan bir etkinlik yok. Bir etkinlikte ekip lideri olarak atandığınızda burada görünür."
        />
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/leader/reviews/${event.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-4 transition-colors hover:border-cyan-500/40 hover:bg-slate-800 focus-visible:outline-2"
              >
                <div className="space-y-1">
                  <p className="font-medium text-white">{event.name}</p>
                  <p className="text-sm text-slate-400">
                    {formatDateTime(event.startsAt)} · {event.teamCount} ekip · {event.memberCount} üye
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {event.completedCount}/{event.memberCount} tamamlandı
                  </Badge>
                  <Badge variant={event.reviewEnabled ? "default" : "secondary"}>
                    {event.reviewEnabled ? "Değerlendirme açık" : "Değerlendirme kapalı"}
                  </Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
