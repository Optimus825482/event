"use client";

import { useEffect, useRef, useState } from "react";
import { formatCountdown, remainingMs } from "./countdown";

type CountdownProps = {
  holdExpiresAt: string;
  /** Sayfanın üretildiği andaki SUNUCU saati (ISO); cihaz saati hiç kullanılmaz. */
  serverNow: string;
  onExpire(): void;
};

const TICK_MS = 250;

/** Ekran okuyucuya yalnızca bu eşiklerde (sn) ve bitişte duyurulur; saniyelik gürültü yoktur. */
const ANNOUNCE_AT: readonly { seconds: number; text: string }[] = [
  { seconds: 300, text: "Kalan süre 5 dakika" },
  { seconds: 120, text: "Kalan süre 2 dakika" },
  { seconds: 60, text: "Kalan süre 1 dakika" },
  { seconds: 30, text: "Kalan süre 30 saniye" },
];

function announcement(remaining: number): string {
  if (remaining === 0) return "Süreniz doldu";
  const reached = ANNOUNCE_AT.filter((t) => remaining <= t.seconds * 1000);
  return reached.length > 0 ? reached[reached.length - 1]!.text : "";
}

/**
 * Kalan süre = (sunucudaki bitiş - yanıt anındaki sunucu zamanı) - yerel monotonik saatle geçen süre.
 * `Date.now()` kullanılmaz: cihaz saati yanlış ya da sonradan değişmiş olabilir.
 * Sunucu üretimi ile hidrasyon arasındaki birkaç yüz ms'lik boşluk cihaz saati olmadan ölçülemez;
 * sayaç bu kadar geç kalabilir. Kesin kural çekirdekte kalır (`hold_expired`).
 */
export function Countdown({ holdExpiresAt, serverNow, onExpire }: CountdownProps) {
  const initial = remainingMs(holdExpiresAt, Date.parse(serverNow));
  const [remaining, setRemaining] = useState(initial);
  const expireRef = useRef(onExpire);

  useEffect(() => {
    expireRef.current = onExpire;
  });

  useEffect(() => {
    const startedAt = performance.now();
    let fired = false;
    const tick = () => {
      const left = Math.max(0, initial - (performance.now() - startedAt));
      setRemaining(left);
      if (left === 0 && !fired) {
        fired = true;
        expireRef.current();
      }
    };
    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => clearInterval(timer);
  }, [initial]);

  return (
    <>
      <p role="timer" aria-live="off" className="m-0 rounded-lg border border-gold bg-surface px-4 py-3 text-lg font-semibold text-ivory">
        {`Kalan süre ${formatCountdown(remaining)}`}
      </p>
      <p role="status" className="sr-only">
        {announcement(remaining)}
      </p>
    </>
  );
}
