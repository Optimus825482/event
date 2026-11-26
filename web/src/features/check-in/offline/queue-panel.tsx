"use client";

import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { QueueItem } from "./queue-core";
import type { OfflineQueue } from "./use-offline-queue";
import { APP_TIME_ZONE } from "@/lib/time-zone";

const timeFormat = new Intl.DateTimeFormat("tr-TR", { timeStyle: "medium", timeZone: APP_TIME_ZONE });

function targetLabel(item: QueueItem): string {
  if ("token" in item.target) return "QR kod";
  if ("legacyHash" in item.target) return "Eski QR kod";
  if ("ticketId" in item.target) return "Bilet";
  if ("walkIn" in item.target) return "Walk-in kaydı";
  return "Manuel giriş";
}

function failureText(item: QueueItem): string {
  return item.failure?.message ?? item.lastError ?? "Bilinmeyen hata";
}

/**
 * Kuyruk durumu: bekleyen sayacı (canlı bölge), oturum uyarısı, kalıcı hata alan girişler.
 * Başka kullanıcıya ait girişler gönderilmez, yalnızca sayısı gösterilir. Kalıcı hata alan öğe kendiliğinden silinmez; operatör "Kaldır" ya da (istek hatalarında)
 * "Yeniden dene" der.
 */
export function QueuePanel({ eventId, queue }: { eventId: string; queue: OfflineQueue }) {
  const pathname = usePathname();
  const mine = queue.items.filter((i) => i.eventId === eventId && i.status !== "failed");
  const failed = queue.failed.filter((i) => i.eventId === eventId);
  const elsewhere = queue.items.filter((i) => i.eventId !== eventId && i.status !== "failed").length;

  return (
    <section aria-label="Çevrimdışı kuyruk" className="space-y-3">
      <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={
            queue.online
              ? "rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
              : "rounded-full bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
          }
        >
          {queue.online ? "Çevrimiçi" : "Çevrimdışı"}
        </span>
        <span>
          {mine.length === 0
            ? "Bekleyen giriş yok"
            : `Bekleyen giriş: ${mine.length}${queue.online ? " (gönderiliyor)" : " (bağlantı gelince gönderilecek)"}`}
        </span>
        {elsewhere > 0 ? (
          <span className="text-muted-foreground">Başka etkinlikler için {elsewhere} bekleyen giriş var.</span>
        ) : null}
        {queue.heldAsideCount > 0 ? (
          <span role="alert" className="text-amber-900 dark:text-amber-100">
            {queue.heldAsideCount} başka kullanıcıya ait bekleyen giriş var; sahibi oturum açınca gönderilecek.
          </span>
        ) : null}
        {mine.length > 0 && queue.online && !queue.paused ? (
          <Button variant="outline" size="sm" onClick={() => void queue.flushNow()}>
            Şimdi gönder
          </Button>
        ) : null}
      </div>

      {!queue.durable ? (
        <p role="alert" className="text-sm text-amber-900 dark:text-amber-100">
          Bu tarayıcı kalıcı depolamayı desteklemiyor; sayfa kapanırsa kuyruktaki girişler kaybolur.
        </p>
      ) : null}

      {queue.paused ? (
        <div role="alert" className="space-y-2 rounded-md border-2 border-amber-500 bg-amber-50 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-semibold">Oturum süresi doldu; kuyruk durduruldu.</p>
          <p className="text-sm">Bekleyen girişler silinmedi. Yeniden giriş yapın; sonra otomatik gönderilir.</p>
          <div className="flex gap-2">
            <Button asChild size="sm">
              <a href={`/login?next=${encodeURIComponent(pathname)}`}>Yeniden giriş yap</a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void queue.resume()}>
              Giriş yaptım, yeniden dene
            </Button>
          </div>
        </div>
      ) : null}

      {mine.some((i) => i.attempts > 0 && i.lastError) ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {mine
            .filter((i) => i.attempts > 0 && i.lastError)
            .map((i) => (
              <li key={i.idempotencyKey}>
                {targetLabel(i)} · {timeFormat.format(new Date(i.clientTimestamp))} · {i.attempts}. deneme: {i.lastError}
              </li>
            ))}
        </ul>
      ) : null}

      {failed.length > 0 ? (
        <div role="alert" className="space-y-2 rounded-md border-2 border-red-500 bg-red-50 p-3 text-red-900 dark:bg-red-950 dark:text-red-100">
          <p className="font-semibold">Gönderilemeyen girişler ({failed.length})</p>
          <p className="text-sm">Bu girişler sunucuda kabul edilmedi. İnceleyip kaldırın; gerekirse misafiri manuel arayın.</p>
          <ul className="space-y-2">
            {failed.map((i) => (
              <li key={i.idempotencyKey} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  {targetLabel(i)} · {timeFormat.format(new Date(i.clientTimestamp))} · {failureText(i)}
                </span>
                <span className="flex gap-2">
                  {i.failure?.kind === "request" ? (
                    <Button variant="outline" size="sm" onClick={() => void queue.retry(i)}>
                      Yeniden dene
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={() => void queue.dismiss(i.idempotencyKey)}>
                    Kaldır
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
