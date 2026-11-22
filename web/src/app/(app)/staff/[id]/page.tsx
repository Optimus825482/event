import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { StaffForm } from "@/features/staff/components/staff-form";
import { StaffStatusControls } from "@/features/staff/components/staff-status-controls";
import { BAND_LABELS } from "@/features/reviews/labels";
import { listStaffReviewHistory } from "@/features/reviews/staff-summary";
import { getStaffDetail, getStaffFormOptions } from "@/features/staff/queries";

export const metadata: Metadata = { title: "Personel kaydı | EventFlow" };

const STATUS_LABELS = { active: "Çalışıyor", inactive: "Pasif", terminated: "Ayrıldı" } as const;

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const actor = await requirePolicyActor();
  if (!can(actor, "staff", "view")) {
    return <p className="text-sm text-muted-foreground">Bu sayfayı görüntüleme yetkiniz yok.</p>;
  }

  const [detail, options] = await Promise.all([getStaffDetail(db, actor, id), getStaffFormOptions(db, actor)]);
  if (!detail) notFound();

  const history = can(actor, "reviews", "view") ? await listStaffReviewHistory(db, actor, id) : [];
  const canEdit = can(actor, "staff", "edit");
  const canDelete = can(actor, "staff", "delete");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/staff" className="text-sm text-slate-400 hover:text-slate-200 hover:underline">
          Personel listesi
        </Link>
        <PageHeader
          className="mt-2"
          title={detail.fullName}
          description={`Sicil ${detail.sicilNo} · ${STATUS_LABELS[detail.status]}${
            detail.status === "terminated" && detail.terminationReason ? ` (${detail.terminationReason})` : ""
          }`}
        />
      </div>

      {canEdit ? (
        <section aria-labelledby="edit-heading" className="space-y-3">
          <h2 id="edit-heading" className="text-lg font-medium">
            Bilgiler
          </h2>
          <StaffForm options={options} initial={detail} />
        </section>
      ) : null}

      <section aria-labelledby="status-heading" className="space-y-3">
        <h2 id="status-heading" className="text-lg font-medium">
          Durum
        </h2>
        <StaffStatusControls
          id={detail.id}
          status={detail.status}
          assignmentCount={detail.assignmentCount}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      </section>

      {history.length > 0 ? (
        <section aria-labelledby="reviews-heading" className="space-y-3">
          <h2 id="reviews-heading" className="text-lg font-medium">
            Değerlendirme geçmişi
          </h2>
          <ul className="divide-y divide-slate-700 rounded-xl border border-slate-700 bg-slate-800/50">
            {history.map((h) => (
              <li key={`${h.eventId}-${h.completedAt}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span className="text-sm">{h.eventName}</span>
                <Badge variant="outline">
                  {h.score} · {BAND_LABELS[h.band]}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
