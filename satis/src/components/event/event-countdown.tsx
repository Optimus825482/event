"use client";

import { useEffect, useState } from "react";

type CountdownParts = {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
};

function computeParts(diffMs: number): CountdownParts {
  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  const seconds = Math.floor((diffMs % 60_000) / 1000);
  return {
    days: String(days).padStart(2, "0"),
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}

export function EventCountdown({ startsAt }: { startsAt: string }): React.JSX.Element {
  const [nowMs, setNowMs] = useState<number | null>(null);
  const targetMs = new Date(startsAt).getTime();
  const validTarget = !Number.isNaN(targetMs);

  useEffect(() => {
    if (!validTarget) return;
    const raf = window.requestAnimationFrame(() => setNowMs(Date.now()));
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearInterval(id);
    };
  }, [validTarget]);

  const remainingMs = !validTarget ? 0 : nowMs === null ? null : Math.max(0, targetMs - nowMs);
  const ended = remainingMs !== null && remainingMs <= 0;
  const parts = remainingMs !== null && remainingMs > 0 ? computeParts(remainingMs) : null;

  const boxes = [
    { label: "Gün", value: parts ? parts.days : "--" },
    { label: "Saat", value: parts ? parts.hours : "--" },
    { label: "Dakika", value: parts ? parts.minutes : "--" },
    { label: "Saniye", value: parts ? parts.seconds : "--" },
  ];

  return (
    <div className="countdown-surface rounded-[16px] border border-line-gold p-4">
      <p className="mb-2.5 text-[11px] font-bold tracking-[0.2em] text-gold-bright uppercase">
        Sahneye Kalan Süre
      </p>
      {ended ? (
        <p className="text-sm font-semibold text-muted">Bu etkinlik gerçekleşti</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {boxes.map((box) => (
            <div key={box.label} className="rounded-[12px] border border-line bg-bg/75 px-2 py-2.5 text-center">
              <b className="block font-serif text-[clamp(26px,3.6vw,36px)] leading-none font-medium text-gold-bright tabular-nums">
                {box.value}
              </b>
              <span className="mt-1.5 block text-[11px] font-semibold tracking-wider text-muted uppercase">
                {box.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
