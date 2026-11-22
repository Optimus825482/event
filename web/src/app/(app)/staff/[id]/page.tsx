import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { StaffForm } from "@/features/staff/components/staff-form";
import { StaffStatusControls } from "@/features/staff/components/staff-status-controls";
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

  const canEdit = can(actor, "staff", "edit");
  const canDelete = can(actor, "staff", "delete");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/staff" className="text-sm text-muted-foreground underline underline-offset-4">
          Personel listesi
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{detail.fullName}</h1>
        <p className="text-sm text-muted-foreground">
          Sicil {detail.sicilNo} · {STATUS_LABELS[detail.status]}
          {detail.status === "terminated" && detail.terminationReason ? ` (${detail.terminationReason})` : ""}
        </p>
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
    </div>
  );
}
