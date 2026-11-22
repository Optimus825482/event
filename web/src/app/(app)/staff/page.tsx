import type { Metadata } from "next";
import Link from "next/link";
import { Settings, UserCheck, UserMinus, UserX, Users } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { listStaffReviewSummaries } from "@/features/reviews/staff-summary";
import { DepartmentCards } from "@/features/staff/components/department-cards";
import { ReviewSummaryTable } from "@/features/staff/components/review-summary-table";
import { StaffFilters } from "@/features/staff/components/staff-filters";
import { StaffForm } from "@/features/staff/components/staff-form";
import { StaffTabs, type StaffTabKey } from "@/features/staff/components/staff-tabs";
import { TeamCardsGrid } from "@/features/staff/components/team-cards-grid";
import { getStaffStats, listDepartmentCards } from "@/features/staff/overview-queries";
import { getStaffFormOptions, listStaff } from "@/features/staff/queries";
import { staffFilterSchema } from "@/features/staff/schemas";
import { listTeamCards } from "@/features/staffing/team-cards";

export const metadata: Metadata = { title: "Personel | EventFlow" };

const STATUS_LABELS = { active: "Çalışıyor", inactive: "Pasif", terminated: "Ayrıldı" } as const;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePolicyActor();
  if (!can(actor, "staff", "view")) {
    return <p className="text-sm text-muted-foreground">Bu sayfayı görüntüleme yetkiniz yok.</p>;
  }

  const raw = await searchParams;
  const canReviews = can(actor, "reviews", "view");
  const available: StaffTabKey[] = canReviews ? ["people", "teams", "reviews"] : ["people", "teams"];
  const requested = first(raw.tab);
  const tab: StaffTabKey = available.find((key) => key === requested) ?? "people";

  const headerActions = can(actor, "staff", "edit") ? (
    <Button asChild variant="outline" size="sm">
      <Link href="/settings/organization">
        <Settings aria-hidden className="size-4" />
        Kuruluş ayarları
      </Link>
    </Button>
  ) : null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Personel" description="Personel, ekipler ve değerlendirmeler" actions={headerActions} />
      <StaffTabs active={tab} available={available} />
      {tab === "people" ? <PeopleTab actor={actor} raw={raw} /> : null}
      {tab === "teams" ? <TeamsTab actor={actor} /> : null}
      {tab === "reviews" ? <ReviewsTab actor={actor} /> : null}
    </div>
  );
}

type Actor = Awaited<ReturnType<typeof requirePolicyActor>>;

async function PeopleTab({ actor, raw }: { actor: Actor; raw: Record<string, string | string[] | undefined> }) {
  const parsed = staffFilterSchema.safeParse({
    search: first(raw.search) || undefined,
    status: first(raw.status) || undefined,
    departmentId: first(raw.departmentId) || undefined,
    positionId: first(raw.positionId) || undefined,
    workLocationId: first(raw.workLocationId) || undefined,
  });
  const filter = parsed.success ? parsed.data : {};

  const [rows, options, stats, departmentCards] = await Promise.all([
    listStaff(db, actor, filter),
    getStaffFormOptions(db, actor),
    getStaffStats(db, actor),
    listDepartmentCards(db, actor),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Toplam" value={stats.total} icon={<Users className="size-5" />} tone="blue" />
        <StatCard label="Aktif" value={stats.active} icon={<UserCheck className="size-5" />} tone="emerald" />
        <StatCard label="Pasif" value={stats.inactive} icon={<UserMinus className="size-5" />} tone="amber" />
        <StatCard label="Ayrılan" value={stats.terminated} icon={<UserX className="size-5" />} tone="red" />
      </div>

      <DepartmentCards cards={departmentCards} activeId={filter.departmentId} />

      {can(actor, "staff", "create") ? (
        <details className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          <summary className="cursor-pointer text-sm font-medium">Yeni personel ekle</summary>
          <div className="mt-4">
            <StaffForm options={options} />
          </div>
        </details>
      ) : null}

      <StaffFilters options={options} />

      <p className="text-sm text-slate-400">{rows.length} kişi listeleniyor</p>
      {rows.length === 0 ? (
        <EmptyState icon={<Users />} title="Kriterlere uyan personel yok" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sicil</TableHead>
              <TableHead>Ad soyad</TableHead>
              <TableHead>Bölüm</TableHead>
              <TableHead>Unvan</TableHead>
              <TableHead>Görev yeri</TableHead>
              <TableHead>Durum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.sicilNo}</TableCell>
                <TableCell>
                  <Link href={`/staff/${row.id}`} className="inline-flex items-center gap-2 font-medium hover:underline">
                    <span
                      aria-hidden
                      className="inline-block size-3 rounded-full"
                      style={{ backgroundColor: row.color ?? "#94a3b8" }}
                    />
                    {row.fullName}
                  </Link>
                </TableCell>
                <TableCell>{row.departmentName ?? "—"}</TableCell>
                <TableCell>{row.positionName ?? "—"}</TableCell>
                <TableCell>{row.workLocationName ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "active" ? "default" : "secondary"}>{STATUS_LABELS[row.status]}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

async function TeamsTab({ actor }: { actor: Actor }) {
  const teamCards = await listTeamCards(db, actor);
  return <TeamCardsGrid teams={teamCards} canOrganize={can(actor, "events", "view")} />;
}

async function ReviewsTab({ actor }: { actor: Actor }) {
  const rows = await listStaffReviewSummaries(db, actor);
  return <ReviewSummaryTable rows={rows} />;
}
