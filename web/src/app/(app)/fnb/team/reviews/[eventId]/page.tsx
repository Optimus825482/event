import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { db } from "@/db/client";
import { ForbiddenError } from "@/features/auth/errors";
import { requirePolicyActor } from "@/features/auth/permissions";
import { ReviewBoardView } from "@/features/reviews/components/review-board";
import { getReviewBoard } from "@/features/reviews/queries";
import { DomainError } from "@/lib/action";
import { isUuid } from "@/lib/identifiers";
import { ownTeamOnly } from "@/features/auth/scope";
import { REVIEW_ROUTES } from "@/features/reviews/routes";

export const metadata: Metadata = { title: "Ekip değerlendirmesi | EventFlow" };

export default async function ReviewBoardPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  if (!isUuid(eventId)) notFound();
  const actor = await requirePolicyActor();

  let board;
  try {
    board = await getReviewBoard(db, actor, eventId);
  } catch (error) {
    // Başkasının ekibi/etkinliği "yok" gibi davranır.
    if (error instanceof DomainError && error.code === "not_found") notFound();
    if (error instanceof ForbiddenError && ownTeamOnly(actor) && actor.staffId !== null) notFound();
    throw error;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={REVIEW_ROUTES.reviews} className="text-sm text-slate-400 hover:text-cyan-300 hover:underline">
        Değerlendirmeler
      </Link>
      <PageHeader className="mt-2" title={board.event.name} description="Ekip üyelerini değerlendirin" />
      <ReviewBoardView board={board} />
    </div>
  );
}
