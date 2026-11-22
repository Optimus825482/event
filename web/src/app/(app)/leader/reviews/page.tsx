import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { listReviewableEvents } from "@/features/reviews/queries";

export const metadata: Metadata = { title: "Değerlendirmeler | EventFlow" };

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

export default async function ReviewsPage() {
  const actor = await requirePolicyActor();
  const events = await listReviewableEvents(db, actor);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Değerlendirmeler</h1>
        <p className="text-sm text-muted-foreground">
          Ekibinizin görev aldığı etkinlikler. Bir etkinliği seçip ekip üyelerini değerlendirin.
        </p>
      </div>

      {events.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Değerlendirilecek ekip üyesi olan bir etkinlik yok. Bir etkinlikte ekip lideri olarak atandığınızda burada görünür.
        </p>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/leader/reviews/${event.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-accent focus-visible:outline-2"
              >
                <div className="space-y-1">
                  <p className="font-medium">{event.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {dateFormat.format(new Date(event.startsAt))} · {event.teamCount} ekip · {event.memberCount} üye
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
