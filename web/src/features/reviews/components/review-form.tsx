"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  completeReviewAction,
  saveReviewAction,
  saveShortReviewAction,
} from "../actions";
import type { ReviewFormKind } from "../form-kinds";
import { BAND_LABELS, RATING_LABELS } from "../labels";
import type { ReviewView } from "../queries";
import {
  RATING_KEYS,
  RATING_WEIGHTS,
  computeScore,
  ratingBand,
  type RatingKey,
} from "../score";
import { RatingInput } from "./rating-input";
import {
  ShortReviewForm,
  type ShortReviewFormValue,
} from "./short-review-form";
import { useToast } from "@/components/ui/toast";

type Props = { eventId: string; staffId: string; review: ReviewView | null };

type Ratings = Record<RatingKey, number | null>;

const textClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Carry = { comment: string; nextEventNotes: string };

const EMPTY_RATINGS = Object.fromEntries(
  RATING_KEYS.map((key) => [key, null]),
) as Ratings;

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
      <textarea
        id={name}
        name={name}
        rows={3}
        defaultValue={defaultValue}
        className={textClass}
      />
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
  // Kayıt yoksa kısa form varsayılandır; aksi hâlde kaydın türü.
  const [kind, setKind] = useState<ReviewFormKind>(review?.formKind ?? "short");
  const [ratings, setRatings] = useState<Ratings>(
    review?.formKind === "full" ? review.ratings : EMPTY_RATINGS,
  );
  const [shortValue, setShortValue] = useState<ShortReviewFormValue>({
    overallRating: review?.formKind === "short" ? review.overallRating : null,
    comment: review?.comment ?? "",
    nextEventNotes: review?.nextEventNotes ?? "",
  });
  // Tür değişince ortak alanlar (kısa not, sonraki etkinlik notu) taşınır; puanlar ve listeler silinir.
  const [carry, setCarry] = useState<Carry | null>(null);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [confirm, setConfirm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const score = computeScore(ratings);
  const rated = RATING_KEYS.filter((key) => ratings[key] !== null).length;
  const allRated =
    kind === "short"
      ? shortValue.overallRating !== null
      : rated === RATING_KEYS.length;
  const hasScores =
    kind === "short" ? shortValue.overallRating !== null : rated > 0;
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
    const res =
      kind === "short"
        ? await saveShortReviewAction({
            eventId,
            staffId,
            overallRating: shortValue.overallRating,
            comment: shortValue.comment,
            nextEventNotes: shortValue.nextEventNotes,
          })
        : await saveReviewAction(readForm(form));
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

  function textOf(name: string): string {
    const field = formRef.current?.elements.namedItem(name);
    return field instanceof HTMLTextAreaElement ? field.value : "";
  }

  /**
   * Geçişte kaybolacak veri var mı: puanlar, madde listeleri ve özel nottaki kaydedilmemiş değişiklik.
   * Kayıtlı özel not kısa kayıtta korunur (`saveShortReview` yazmaz), bu yüzden sayılmaz.
   */
  function hasDiscardable(): boolean {
    if (hasScores) return true;
    if (kind === "short") return false;
    if (["strengths", "improvements", "recommendedTrainings"].some((name) => textOf(name).trim() !== "")) return true;
    return textOf("privateNotes").trim() !== (review?.privateNotes ?? "").trim();
  }

  function switchKind() {
    const text = textOf;
    const next: ReviewFormKind = kind === "short" ? "full" : "short";
    const shared: Carry =
      kind === "short"
        ? {
            comment: shortValue.comment,
            nextEventNotes: shortValue.nextEventNotes,
          }
        : { comment: text("comment"), nextEventNotes: text("nextEventNotes") };
    setCarry(shared);
    setRatings(EMPTY_RATINGS);
    setShortValue({ overallRating: null, ...shared });
    setFieldErrors({});
    setMessage(null);
    setKind(next);
    setSwitchOpen(false);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(event.currentTarget, false);
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="space-y-5"
      aria-busy={pending}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {kind === "short" ? "Kısa değerlendirme" : "Ayrıntılı değerlendirme"}
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => (hasDiscardable() ? setSwitchOpen(true) : switchKind())}
          className="text-sm text-primary underline underline-offset-2 disabled:opacity-60"
        >
          {kind === "short" ? "Ayrıntılı forma geç" : "Kısa forma geç"}
        </button>
      </div>

      {kind === "short" ? (
        <ShortReviewForm
          value={shortValue}
          onChange={setShortValue}
          disabled={pending}
        />
      ) : (
        <>
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
                onChange={(value) =>
                  setRatings((prev) => ({ ...prev, [key]: value }))
                }
              />
            ))}
          </div>

          <p
            className="rounded-md bg-muted px-3 py-2 text-sm"
            aria-live="polite"
          >
            {rated === 0 ? (
              "Puanlama yapılmadı."
            ) : (
              <>
                Genel puan: <strong>{score}</strong> / 100 (
                {BAND_LABELS[ratingBand(score)]}) · {rated}/{RATING_KEYS.length}{" "}
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
          <Notes
            name="comment"
            label="Yorum"
            defaultValue={carry?.comment ?? review?.comment ?? ""}
            errors={fieldErrors.comment}
          />
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
              defaultValue={
                carry?.nextEventNotes ?? review?.nextEventNotes ?? ""
              }
              errors={fieldErrors.nextEventNotes}
            />
          </div>
        </>
      )}

      {message ? (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={
            message.kind === "error"
              ? "text-sm text-destructive"
              : "text-sm text-emerald-600"
          }
        >
          {message.text}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Kaydediliyor..." : "Taslağı kaydet"}
        </Button>
        <Button
          type="button"
          disabled={pending || !allRated}
          onClick={() => setConfirm(true)}
        >
          Tamamla
        </Button>
        {allRated ? null : (
          <p className="self-center text-xs text-muted-foreground">
            {kind === "short"
              ? "Tamamlamak için genel puan verilmeli."
              : "Tamamlamak için tüm kategoriler puanlanmalı."}
          </p>
        )}
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
      <ConfirmDialog
        open={switchOpen}
        onOpenChange={setSwitchOpen}
        title={kind === "short" ? "Ayrıntılı forma geç" : "Kısa forma geç"}
        description={
          kind === "short"
            ? "Girilen puan silinecek; kısa not ve sonraki etkinlik notu korunur. Devam edilsin mi?"
            : "Girilen puanlar ve madde listeleri silinecek, kaydedilmemiş özel not değişiklikleri kaybolur; yorum, sonraki etkinlik notu ve kayıtlı özel not korunur. Devam edilsin mi?"
        }
        confirmText="Devam et"
        onConfirm={switchKind}
      />
    </form>
  );
}
