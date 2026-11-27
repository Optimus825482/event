"use client";

import { AlertTriangle, CheckCircle2, Clock, MapPin, XCircle, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { batchMessage, batchTone } from "./batch-feedback";
import { resultLine } from "./order-view";
import type { CheckInFeedback, QueuedReason } from "./use-check-in";
import { APP_TIME_ZONE } from "@/lib/time-zone";

const timeFormat = new Intl.DateTimeFormat("tr-TR", {
  timeStyle: "short",
  timeZone: APP_TIME_ZONE,
});

const QUEUED_TITLE: Record<QueuedReason, string> = {
  network: "Çevrimdışı — kuyruğa alındı",
  server: "Sunucuya ulaşılamadı — kuyruğa alındı",
  auth: "Oturum süresi doldu — kuyruğa alındı",
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) || date.getTime() === 0 ? "bilinmeyen saat" : timeFormat.format(date);
}

function CloseButton({ onClose, className }: { onClose: () => void; className: string }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm transition-colors ${className}`}
    >
      <X className="h-4 w-4" aria-hidden="true" />
      Kapat
    </button>
  );
}

/** Son check-in denemesinin sonucu: yeşil başarı, sarı "zaten giriş yaptı", mavi kuyruk, kırmızı ret. */
export function CheckInFeedbackBanner({
  feedback,
  onClose,
}: {
  feedback: CheckInFeedback | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Toplu gönderim bitince düğmesi kaybolur/devre dışı kalır; odak gövdeye düşmesin diye banta taşınır.
  // Diğer sonuçlarda odak yalnızca gövdeye düşmüşse taşınır (tarayıcı girişindeki odak bozulmaz).
  useEffect(() => {
    if (!feedback) return;
    if (feedback.kind === "batch" || document.activeElement === document.body) ref.current?.focus();
  }, [feedback]);

  if (!feedback) return null;
  const focusable = { ref, tabIndex: -1, "data-testid": "check-in-feedback" } as const;

  if (feedback.kind === "error") {
    return (
      <div
        {...focusable}
        role="alert"
        className="flex items-start justify-between gap-4 rounded-xl border-2 border-red-500/60 bg-red-500/10 p-4 text-red-100"
      >
        <div className="flex items-start gap-3">
          <XCircle className="mt-1 h-6 w-6 shrink-0 text-red-400" aria-hidden="true" />
          <div>
            <p className="text-lg font-semibold">Giriş yapılamadı</p>
            <p>{feedback.message}</p>
          </div>
        </div>
        <CloseButton onClose={onClose} className="text-red-200 hover:bg-red-500/20" />
      </div>
    );
  }

  if (feedback.kind === "queued") {
    return (
      <div
        {...focusable}
        role="status"
        aria-live="assertive"
        className="flex items-start justify-between gap-4 rounded-xl border-2 border-sky-500/60 bg-sky-500/10 p-4 text-sky-100"
      >
        <div className="flex items-start gap-3">
          <Clock className="mt-1 h-6 w-6 shrink-0 text-sky-400" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-lg font-semibold">{QUEUED_TITLE[feedback.reason]}</p>
            <p>Bu giriş henüz sunucuda ONAYLANMADI. Bağlantı gelince otomatik gönderilir; bekleyen sayısı aşağıda görünür.</p>
          </div>
        </div>
        <CloseButton onClose={onClose} className="text-sky-200 hover:bg-sky-500/20" />
      </div>
    );
  }

  if (feedback.kind === "batch") {
    const { tally } = feedback;
    const tone = batchTone(tally);
    return (
      <div
        {...focusable}
        role="status"
        aria-live="assertive"
        className={cn(
          "flex items-start justify-between gap-4 rounded-xl border-2 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
          tone === "ok" && "border-emerald-500/60 bg-emerald-500/10 text-emerald-100",
          tone === "warn" && "border-amber-500/60 bg-amber-500/10 text-amber-100",
          tone === "info" && "border-sky-500/60 bg-sky-500/10 text-sky-100",
        )}
      >
        <div className="space-y-1">
          <p className="text-lg font-semibold">{batchMessage(tally)}</p>
          {tally.queued > 0 ? (
            <p>Kuyruğa alınan girişler henüz sunucuda ONAYLANMADI; bağlantı gelince otomatik gönderilir.</p>
          ) : null}
          {tally.failed > 0 ? (
            <p>
              Reddedilen biletler gönderilemeyen girişler listesinde nedenleriyle görünür. Ödemesi sonradan tamamlanan bilet
              için kodu yeniden okutun.
            </p>
          ) : null}
        </div>
        <CloseButton
          onClose={onClose}
          className={cn(
            tone === "ok" && "text-emerald-200 hover:bg-emerald-500/20",
            tone === "warn" && "text-amber-200 hover:bg-amber-500/20",
            tone === "info" && "text-sky-200 hover:bg-sky-500/20",
          )}
        />
      </div>
    );
  }

  const { result } = feedback;
  const success = feedback.kind === "success";
  const Icon = success ? CheckCircle2 : AlertTriangle;
  return (
    <div
      {...focusable}
      role="status"
      aria-live="assertive"
      className={
        success
          ? "flex items-start justify-between gap-4 rounded-xl border-2 border-emerald-500/60 bg-emerald-500/10 p-4 text-emerald-100"
          : "flex items-start justify-between gap-4 rounded-xl border-2 border-amber-500/60 bg-amber-500/10 p-4 text-amber-100"
      }
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-1 h-6 w-6 shrink-0 ${success ? "text-emerald-400" : "text-amber-400"}`} aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-lg font-semibold">{success ? "Giriş yapıldı" : "Bu misafir zaten giriş yaptı"}</p>
          <p className="text-2xl font-bold text-white">Masa {result.tableLabel}</p>
          <p>{resultLine(result)}</p>
          {!success ? (
            <p className="text-sm">
              {formatTime(result.checkedInAt)}
              {result.checkedInBy ? ` · ${result.checkedInBy.username}` : ""}
            </p>
          ) : null}
          <Link
            href={`/check-in/${result.eventId}/plan?masa=${encodeURIComponent(result.tableId)}`}
            className="inline-flex items-center gap-1 text-sm underline underline-offset-2 hover:text-white"
          >
            <MapPin className="h-4 w-4" aria-hidden="true" />
            Masayı planda göster
          </Link>
        </div>
      </div>
      <CloseButton
        onClose={onClose}
        className={success ? "text-emerald-200 hover:bg-emerald-500/20" : "text-amber-200 hover:bg-amber-500/20"}
      />
    </div>
  );
}
