import { BAND_LABELS, RATING_LABELS } from "../labels";
import type { ReviewView } from "../queries";
import { RATING_KEYS } from "../score";

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-sm font-medium">{title}</h4>
      <ul className="list-disc pl-5 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Note({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return (
    <div>
      <h4 className="text-sm font-medium">{title}</h4>
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

/** Salt okunur değerlendirme (tamamlanan ya da sistem kapalıyken). */
export function ReviewSummary({ review }: { review: ReviewView }) {
  return (
    <div className="space-y-4">
      <p className="text-sm">
        Genel puan: <strong>{review.score}</strong> / 100 ({BAND_LABELS[review.band]})
      </p>
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {RATING_KEYS.map((key) => (
          <div key={key} className="flex justify-between border-b border-border py-1 text-sm">
            <dt>{RATING_LABELS[key]}</dt>
            <dd className="font-medium">{review.ratings[key] ?? "-"}</dd>
          </div>
        ))}
      </dl>
      <List title="Güçlü yönler" items={review.strengths} />
      <List title="Geliştirilecek yönler" items={review.improvements} />
      <List title="Önerilen eğitimler" items={review.recommendedTrainings} />
      <Note title="Yorum" text={review.comment} />
      <Note title="Özel notlar" text={review.privateNotes} />
      <Note title="Sonraki etkinlik notları" text={review.nextEventNotes} />
    </div>
  );
}
