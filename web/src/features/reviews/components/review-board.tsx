import { Badge } from "@/components/ui/badge";
import { BAND_LABELS } from "../labels";
import type { BoardMember, ReviewBoard } from "../queries";
import { CompleteAllButton } from "./complete-all-button";
import { ReviewForm } from "./review-form";
import { ReviewSummary } from "./review-summary";

function StatusBadge({ member }: { member: BoardMember }) {
  const review = member.review;
  if (!review) return <Badge variant="outline">Bekliyor</Badge>;
  if (review.isCompleted) {
    return (
      <Badge>
        Tamamlandı · {review.score} ({BAND_LABELS[review.band]})
      </Badge>
    );
  }
  return <Badge variant="secondary">Taslak</Badge>;
}

function MemberReview({ eventId, member, writable }: { eventId: string; member: BoardMember; writable: boolean }) {
  const review = member.review;
  if (review?.isCompleted) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Bu değerlendirme tamamlandı ve kilitlendi.</p>
        <ReviewSummary review={review} />
      </div>
    );
  }
  if (!writable) {
    return review ? (
      <ReviewSummary review={review} />
    ) : (
      <p className="text-sm text-muted-foreground">Bu etkinlik için değerlendirme sistemi kapalı.</p>
    );
  }
  return <ReviewForm eventId={eventId} staffId={member.staffId} review={review} />;
}

export function ReviewBoardView({ board }: { board: ReviewBoard }) {
  const writable = board.event.reviewEnabled;
  const totalMembers = board.teams.reduce((sum, t) => sum + t.members.length, 0);

  if (board.teams.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Bu etkinlikte değerlendirebileceğiniz bir ekip yok.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {writable ? null : (
        <p role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          Bu etkinlik için değerlendirme sistemi kapalı. Değerlendirmeler yalnızca görüntülenebilir.
        </p>
      )}
      {writable && totalMembers > 0 ? <CompleteAllButton eventId={board.event.id} /> : null}
      {board.teams.map((team) => (
        <section key={team.id} aria-labelledby={`team-${team.id}`} className="space-y-3">
          <h2 id={`team-${team.id}`} className="flex items-center gap-2 text-lg font-semibold">
            <span aria-hidden className="size-3 rounded-full" style={{ backgroundColor: team.color }} />
            {team.name}
          </h2>
          {team.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bu ekipte değerlendirilecek üye yok.</p>
          ) : (
            <ul className="space-y-2">
              {team.members.map((member) => (
                <li key={member.staffId} className="rounded-lg border border-border">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:outline-2">
                      <span className="font-medium">{member.fullName}</span>
                      <StatusBadge member={member} />
                    </summary>
                    <div className="border-t border-border px-4 py-4">
                      <MemberReview eventId={board.event.id} member={member} writable={writable} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
