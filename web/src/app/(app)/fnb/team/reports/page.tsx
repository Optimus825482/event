import type { Metadata } from "next";
import { CalendarClock, CalendarDays, Users, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { LeaderNoAccess, LeaderStat, Panel, SectionTitle, TrendText } from "@/features/reviews/components/leader-ui";
import { getLeaderReport } from "@/features/reviews/leader-queries";
import { canUseLeaderPanel } from "@/features/reviews/leader-scope";

export const metadata: Metadata = { title: "Raporlar | Lider | EventFlow" };

export default async function LeaderReportsPage() {
  const actor = await requirePolicyActor();
  if (!canUseLeaderPanel(actor)) return <LeaderNoAccess />;
  const report = await getLeaderReport(db, actor);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Raporlar" description="Takımlarınızın özet göstergeleri" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <LeaderStat label="Toplam Takım" value={report.teamCount} icon={<UsersRound className="size-5" />} />
        <LeaderStat label="Ekip Üyesi" value={report.memberCount} icon={<Users className="size-5" />} />
        <LeaderStat label="Yaklaşan Etkinlik" value={report.upcomingEventCount} icon={<CalendarClock className="size-5" />} />
        <LeaderStat label="Atanan Etkinlik" value={report.eventCount} icon={<CalendarDays className="size-5" />} />
      </div>

      {report.teamCount === 0 ? (
        <EmptyState
          title="Rapor için takım yok"
          description="Bir etkinlikte ekip lideri, süpervizör ya da kısım sorumlusu olarak atandığınızda raporlar burada görünür."
        />
      ) : (
        <div className="space-y-6">
          <Panel>
            <SectionTitle>Takım özeti</SectionTitle>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Takım</TableHead>
                  <TableHead>Etkinlik</TableHead>
                  <TableHead className="text-right">Üye</TableHead>
                  <TableHead className="text-right">Değerlendirilen</TableHead>
                  <TableHead className="text-right">Ortalama puan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row) => (
                  <TableRow key={row.teamId}>
                    <TableCell className="font-medium">{row.teamName}</TableCell>
                    <TableCell>{row.eventName ?? "Genel ekip"}</TableCell>
                    <TableCell className="text-right">{row.memberCount}</TableCell>
                    <TableCell className="text-right">
                      {row.reviewedCount}/{row.memberCount}
                    </TableCell>
                    <TableCell className="text-right">{row.averageScore ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
          <div className="grid gap-4 sm:grid-cols-3">
            <LeaderStat label="Ortalama Puan" value={report.averageScore ?? "-"} />
            <LeaderStat label="Tamamlanan Değerlendirme" value={report.reviewCount} />
            <LeaderStat label="Trend" value={<TrendText trend={report.trend} />} />
          </div>
          <Panel>
            <SectionTitle>Raporlar hakkında</SectionTitle>
            <p className="text-sm text-slate-400">
              Göstergeler yalnızca yönettiğiniz takımları ve tamamladığınız değerlendirmeleri kapsar. Puanlar 0-100
              aralığındadır; trend, eski ve yeni değerlendirmelerin ortalamasının karşılaştırmasıdır.
            </p>
          </Panel>
        </div>
      )}
    </div>
  );
}
