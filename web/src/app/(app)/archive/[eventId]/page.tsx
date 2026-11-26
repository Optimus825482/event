import { Archive } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/db/client";
import { ArchiveDetail } from "@/features/archive/components/archive-detail";
import { RebuildButton } from "@/features/archive/components/rebuild-button";
import { getArchiveView } from "@/features/archive/read";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { DomainError } from "@/lib/action";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Arşiv ayrıntısı | EventFlow" };

export default async function ArchiveDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const actor = await requirePolicyActor();
  const { eventId } = await params;
  const archive = await getArchiveView(db, actor, eventId).catch((error: unknown) => {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={archive.eventName}
        description={`Sürüm ${archive.revision} · ${formatDate(archive.archivedAt, "datetime")}`}
        icon={<Archive className="size-8 text-blue-400" aria-hidden />}
        actions={
          <>
            <Link className={buttonVariants({ variant: "outline" })} href="/archive">
              Arşive dön
            </Link>
            <a className={buttonVariants({ variant: "secondary" })} href={`/archive/${archive.eventId}/export`}>
              Excel&apos;e aktar
            </a>
            {can(actor, "archive", "edit") ? <RebuildButton eventId={archive.eventId} /> : null}
          </>
        }
      />
      <ArchiveDetail archive={archive} />
    </div>
  );
}
