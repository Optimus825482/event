"use client";

import { Button } from "@/components/ui/button";
import type { CheckInFeedback, QueuedReason } from "./use-check-in";

const timeFormat = new Intl.DateTimeFormat("tr-TR", {
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
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

/** Son check-in denemesinin sonucu: yeşil başarı, sarı "zaten giriş yaptı", kırmızı ret. */
export function CheckInFeedbackBanner({
  feedback,
  onClose,
}: {
  feedback: CheckInFeedback | null;
  onClose: () => void;
}) {
  if (!feedback) return null;

  if (feedback.kind === "error") {
    return (
      <div
        role="alert"
        className="flex items-start justify-between gap-4 rounded-lg border-2 border-red-500 bg-red-50 p-4 text-red-900 dark:bg-red-950 dark:text-red-100"
      >
        <div>
          <p className="text-lg font-semibold">Giriş yapılamadı</p>
          <p>{feedback.message}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Kapat
        </Button>
      </div>
    );
  }

  if (feedback.kind === "queued") {
    return (
      <div
        role="status"
        className="flex items-start justify-between gap-4 rounded-lg border-2 border-sky-500 bg-sky-50 p-4 text-sky-900 dark:bg-sky-950 dark:text-sky-100"
      >
        <div className="space-y-1">
          <p className="text-lg font-semibold">{QUEUED_TITLE[feedback.reason]}</p>
          <p>Bu giriş henüz sunucuda ONAYLANMADI. Bağlantı gelince otomatik gönderilir; bekleyen sayısı aşağıda görünür.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Kapat
        </Button>
      </div>
    );
  }

  const { result } = feedback;
  const success = feedback.kind === "success";
  return (
    <div
      role="status"
      className={
        success
          ? "flex items-start justify-between gap-4 rounded-lg border-2 border-emerald-500 bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
          : "flex items-start justify-between gap-4 rounded-lg border-2 border-amber-500 bg-amber-50 p-4 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
      }
    >
      <div className="space-y-1">
        <p className="text-lg font-semibold">{success ? "Giriş yapıldı" : "Bu misafir zaten giriş yaptı"}</p>
        <p className="text-2xl font-bold">Masa {result.tableLabel}</p>
        <p>
          {result.guestName ?? "Misafir"} · {result.guestCount} kişi
        </p>
        {!success ? (
          <p className="text-sm">
            {formatTime(result.checkedInAt)}
            {result.checkedInBy ? ` · ${result.checkedInBy.username}` : ""}
          </p>
        ) : null}
      </div>
      <Button variant="ghost" size="sm" onClick={onClose}>
        Kapat
      </Button>
    </div>
  );
}
