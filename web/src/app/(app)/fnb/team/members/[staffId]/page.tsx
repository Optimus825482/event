import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import {
  formatDate,
  LeaderNoAccess,
  LeaderStat,
  Panel,
  ScoreBadge,
  SectionTitle,
  TrendText,
} from "@/features/reviews/components/leader-ui";
import { RATING_LABELS } from "@/features/reviews/labels";
import { orNotFound } from "@/features/reviews/leader-page";
import { getMemberPerformance } from "@/features/reviews/leader-queries";
import { canUseLeaderPanel } from "@/features/reviews/leader-scope";
import { RATING_KEYS } from "@/features/reviews/score";
import { REVIEW_ROUTES } from "@/features/reviews/routes";
import { isUuid } from "@/lib/identifiers";

export const metadata: Metadata = { title: "Performans analizi | Lider | EventFlow" };

export default async function LeaderMemberPage({ params }: { params: Promise<{ staffId: string }> }) {
  const { staffId } = await params;
  if (!isUuid(staffId)) notFound();
  const actor = await requirePolicyActor();
  if (!canUseLeaderPanel(actor)) return <LeaderNoAccess />;
  const perf = await orNotFound(() => getMemberPerformance(db, actor, staffId));

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={REVIEW_ROUTES.members} className="text-sm text-slate-400 hover:text-cyan-300 hover:underline">
        Ekip
      </Link>
      <PageHeader
        className="mt-2"
        title={perf.fullName}
        description={`Sicil ${perf.sicilNo} · ${perf.teams.map((t) => t.name).join(", ")}`}
      />
      {perf.reviewCount === 0 ? (
        <EmptyState
          title="Henüz tamamlanmış değerlendirme yok"
          description="Bu üyeyi bir etkinlikte değerlendirip tamamladığınızda performans analizi burada görünür."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <LeaderStat label="Ortalama Puan" value={perf.averageScore ?? "-"} />
            <LeaderStat label="Değerlendirme" value={perf.reviewCount} />
            <LeaderStat label="Trend" value={<TrendText trend={perf.trend} />} />
          </div>
          <Panel>
            <SectionTitle>Kategori ortalamaları</SectionTitle>
            <ul className="space-y-3">
              {RATING_KEYS.map((key) => {
                const value = perf.categories[key];
                return (
                  <li key={key}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-slate-300">{RATING_LABELS[key]}</span>
                      <span className="font-medium text-white">{value === null ? "-" : `${value} / 5`}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-700" role="presentation">
                      <div className="h-full rounded-full bg-cyan-500" style={{ width: `${((value ?? 0) / 5) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
          <Panel>
            <SectionTitle>Değerlendirme geçmişi</SectionTitle>
            <ul className="divide-y divide-slate-700">
              {perf.history.map((h) => (
                <li key={h.eventId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="block text-sm font-medium text-white">{h.eventName}</span>
                    <span className="block text-xs text-slate-400">{formatDate(h.completedAt)}</span>
                  </span>
                  <ScoreBadge score={h.score} band={h.band} />
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}
