import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { ForbiddenError } from "@/features/auth/errors";
import { requirePolicyActor } from "@/features/auth/permissions";
import { ReviewBoardView } from "@/features/reviews/components/review-board";
import { getReviewBoard } from "@/features/reviews/queries";
import { DomainError } from "@/lib/action";
import { isUuid } from "@/lib/identifiers";

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
    if (error instanceof ForbiddenError && actor.role === "leader" && actor.staffId !== null) notFound();
    throw error;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-1">
        <Link href="/leader/reviews" className="text-sm text-muted-foreground hover:underline">
          Değerlendirmeler
        </Link>
        <h1 className="text-2xl font-semibold">{board.event.name}</h1>
      </div>
      <ReviewBoardView board={board} />
    </div>
  );
}
