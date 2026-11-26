"use client";

import { useId, type KeyboardEvent } from "react";

export type ShortReviewFormValue = {
  overallRating: number | null;
  comment: string;
  nextEventNotes: string;
};

type Props = {
  value: ShortReviewFormValue;
  onChange: (value: ShortReviewFormValue) => void;
  disabled?: boolean;
};

const STARS = [1, 2, 3, 4, 5] as const;
const NOTE_MAX = 500;

/**
 * Kısa değerlendirme formu (kontrollü): 1–5 yıldız, kısa not, sonraki etkinlik notu.
 * Yıldızlar ok tuşlarıyla gezilir (tek tab durağı); kaydet/tamamla düğmeleri ebeveyndedir.
 */
export function ShortReviewForm({ value, onChange, disabled }: Props) {
  const id = useId();
  const set = (patch: Partial<ShortReviewFormValue>) => onChange({ ...value, ...patch });

  // Tab durağı: seçili yıldız, seçim yoksa ilki.
  const tabStop = value.overallRating ?? 1;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, star: number) {
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = Math.min(5, star + 1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = Math.max(1, star - 1);
    else if (event.key === "Home") next = 1;
    else if (event.key === "End") next = 5;
    if (next === null) return;
    event.preventDefault();
    set({ overallRating: next });
    event.currentTarget.parentElement?.querySelectorAll("button")[next - 1]?.focus();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <span id={`${id}-stars`} className="text-sm font-medium">
          Genel puan
        </span>
        <div role="group" aria-labelledby={`${id}-stars`} className="flex gap-1">
          {STARS.map((star) => {
            const selected = value.overallRating === star;
            const filled = value.overallRating !== null && star <= value.overallRating;
            return (
              <button
                key={star}
                type="button"
                aria-label={`${star} puan`}
                aria-pressed={selected}
                disabled={disabled}
                tabIndex={star === tabStop ? 0 : -1}
                onClick={() => set({ overallRating: selected ? null : star })}
                onKeyDown={(e) => onKeyDown(e, star)}
                className={`flex size-11 items-center justify-center rounded-md border text-2xl leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                  filled
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                <span aria-hidden="true">{filled ? "★" : "☆"}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {value.overallRating === null ? "Henüz puan verilmedi" : `${value.overallRating} / 5 puan verildi`}
        </p>
      </div>

      <NoteField
        id={`${id}-comment`}
        label="Kısa not"
        value={value.comment}
        disabled={disabled}
        onChange={(comment) => set({ comment })}
      />
      <NoteField
        id={`${id}-next`}
        label="Sonraki etkinlik notu"
        value={value.nextEventNotes}
        disabled={disabled}
        onChange={(nextEventNotes) => set({ nextEventNotes })}
      />
    </div>
  );
}

function NoteField(props: {
  id: string;
  label: string;
  value: string;
  disabled?: boolean | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={props.id} className="text-sm font-medium">
        {props.label}
      </label>
      <textarea
        id={props.id}
        value={props.value}
        maxLength={NOTE_MAX}
        rows={3}
        disabled={props.disabled}
        aria-describedby={`${props.id}-count`}
        onChange={(e) => props.onChange(e.target.value)}
        className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      />
      <p id={`${props.id}-count`} className="text-right text-xs text-muted-foreground">
        {props.value.length}/{NOTE_MAX}
      </p>
    </div>
  );
}
