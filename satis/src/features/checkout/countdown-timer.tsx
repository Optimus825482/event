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

/**
 * Kalan süre = (sunucudaki bitiş - yanıt anındaki sunucu zamanı) - yerel monotonik saatle geçen süre.
 * `Date.now()` kullanılmaz: cihaz saati yanlış ya da sonradan değişmiş olabilir.
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
    <p aria-live="polite" className="m-0 rounded-lg border border-gold bg-surface px-4 py-3 text-lg font-semibold text-ivory">
      {`Kalan süre ${formatCountdown(remaining)}`}
    </p>
  );
}
