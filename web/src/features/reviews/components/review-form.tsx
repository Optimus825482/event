"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { completeReviewAction, saveReviewAction } from "../actions";
import { BAND_LABELS, RATING_LABELS } from "../labels";
import type { ReviewView } from "../queries";
import { RATING_KEYS, RATING_WEIGHTS, computeScore, ratingBand, type RatingKey } from "../score";
import { RatingInput } from "./rating-input";
import { useToast } from "@/components/ui/toast";

type Props = { eventId: string; staffId: string; review: ReviewView | null };

type Ratings = Record<RatingKey, number | null>;

const textClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

const EMPTY_RATINGS = Object.fromEntries(RATING_KEYS.map((key) => [key, null])) as Ratings;

function toLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

function Notes({
  name,
  label,
  defaultValue,
  errors,
  hint,
}: {
  name: string;
  label: string;
  defaultValue: string;
  errors?: string[] | undefined;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <textarea id={name} name={name} rows={3} defaultValue={defaultValue} className={textClass} />
      {errors?.map((message) => (
        <p key={message} role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ))}
    </div>
  );
}

export function ReviewForm({ eventId, staffId, review }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [ratings, setRatings] = useState<Ratings>(review?.ratings ?? EMPTY_RATINGS);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [confirm, setConfirm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const score = computeScore(ratings);
  const rated = RATING_KEYS.filter((key) => ratings[key] !== null).length;
  const allRated = rated === RATING_KEYS.length;
  const idPrefix = `${staffId}`;

  function readForm(form: HTMLFormElement) {
    const data = new FormData(form);
    const text = (name: string) => {
      const value = data.get(name);
      return typeof value === "string" ? value : "";
    };
    return {
      eventId,
      staffId,
      ratings,
      strengths: toLines(text("strengths")),
      improvements: toLines(text("improvements")),
      recommendedTrainings: toLines(text("recommendedTrainings")),
      comment: text("comment"),
      privateNotes: text("privateNotes"),
      nextEventNotes: text("nextEventNotes"),
    };
  }

  async function save(form: HTMLFormElement): Promise<boolean> {
    const res = await saveReviewAction(readForm(form));
    if (!res.ok) {
      setFieldErrors(res.fieldErrors ?? {});
      setMessage({ kind: "error", text: res.message });
      toast.error(res.message);
      return false;
    }
    setFieldErrors({});
    return true;
  }

  async function run(form: HTMLFormElement, complete: boolean) {
    setPending(true);
    setMessage(null);
    try {
      if (!(await save(form))) return;
      if (complete) {
        const done = await completeReviewAction({ eventId, staffId });
        if (!done.ok) {
          setMessage({ kind: "error", text: done.message });
          toast.error(done.message);
          return;
        }
        toast.success("Değerlendirme tamamlandı");
        router.refresh();
        return;
      }
      setMessage({ kind: "ok", text: "Taslak kaydedildi" });
      toast.success("Taslak kaydedildi");
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: "Beklenmeyen bir hata oluştu" });
      toast.error("Beklenmeyen bir hata oluştu");
    } finally {
      setPending(false);
      setConfirm(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(event.currentTarget, false);
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-5" aria-busy={pending}>
      <div className="grid gap-4 sm:grid-cols-2">
        {RATING_KEYS.map((key) => (
          <RatingInput
            key={key}
            name={`${idPrefix}-${key}`}
            label={RATING_LABELS[key]}
            weight={RATING_WEIGHTS[key]}
            value={ratings[key]}
            disabled={pending}
            error={fieldErrors[`ratings.${key}`]?.[0]}
            onChange={(value) => setRatings((prev) => ({ ...prev, [key]: value }))}
          />
        ))}
      </div>

      <p className="rounded-md bg-muted px-3 py-2 text-sm" aria-live="polite">
        {rated === 0 ? (
          "Puanlama yapılmadı."
        ) : (
          <>
            Genel puan: <strong>{score}</strong> / 100 ({BAND_LABELS[ratingBand(score)]}) · {rated}/{RATING_KEYS.length}{" "}
            kategori puanlandı
          </>
        )}
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <Notes
          name="strengths"
          label="Güçlü yönler"
          hint="Her satıra bir madde"
          defaultValue={review?.strengths.join("\n") ?? ""}
          errors={fieldErrors.strengths}
        />
        <Notes
          name="improvements"
          label="Geliştirilecek yönler"
          hint="Her satıra bir madde"
          defaultValue={review?.improvements.join("\n") ?? ""}
          errors={fieldErrors.improvements}
        />
        <Notes
          name="recommendedTrainings"
          label="Önerilen eğitimler"
          hint="Her satıra bir madde"
          defaultValue={review?.recommendedTrainings.join("\n") ?? ""}
          errors={fieldErrors.recommendedTrainings}
        />
      </div>
      <Notes name="comment" label="Yorum" defaultValue={review?.comment ?? ""} errors={fieldErrors.comment} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Notes
          name="privateNotes"
          label="Özel notlar"
          defaultValue={review?.privateNotes ?? ""}
          errors={fieldErrors.privateNotes}
        />
        <Notes
          name="nextEventNotes"
          label="Sonraki etkinlik notları"
          defaultValue={review?.nextEventNotes ?? ""}
          errors={fieldErrors.nextEventNotes}
        />
      </div>

      {message ? (
        <p role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "text-sm text-destructive" : "text-sm text-emerald-600"}>
          {message.text}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Kaydediliyor..." : "Taslağı kaydet"}
        </Button>
        <Button type="button" disabled={pending || !allRated} onClick={() => setConfirm(true)}>
          Tamamla
        </Button>
        {allRated ? null : <p className="self-center text-xs text-muted-foreground">Tamamlamak için tüm kategoriler puanlanmalı.</p>}
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Değerlendirmeyi tamamla"
        description="Tamamlanan değerlendirme kilitlenir ve artık değiştirilemez."
        confirmText="Tamamla"
        loading={pending}
        onConfirm={() => {
          if (formRef.current) void run(formRef.current, true);
        }}
      />
    </form>
  );
}
