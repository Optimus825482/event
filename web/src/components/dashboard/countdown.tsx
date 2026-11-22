"use client";

import { useSyncExternalStore } from "react";

function subscribe(onTick: () => void): () => void {
  const timer = window.setInterval(onTick, 1000);
  return () => window.clearInterval(timer);
}

// Anlık görüntü saniye cinsindendir; sunucuda ve hidrasyonda null (yer tutucu) döner.
const getNowSeconds = () => Math.floor(Date.now() / 1000);
const getServerNow = () => null;

type Parts = { days: number; hours: number; minutes: number; seconds: number };

export function countdownParts(targetMs: number, nowMs: number): Parts {
  const diff = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  return {
    days: Math.floor(diff / 86_400),
    hours: Math.floor((diff % 86_400) / 3_600),
    minutes: Math.floor((diff % 3_600) / 60),
    seconds: diff % 60,
  };
}

const pad = (value: number | null) => (value === null ? "--" : String(value).padStart(2, "0"));

/** Etkinliğe kalan süre (gün : saat : dk : sn); saniyede bir güncellenir. */
export function Countdown({ target }: { target: string }) {
  const nowSeconds = useSyncExternalStore(subscribe, getNowSeconds, getServerNow);
  const parts = nowSeconds === null ? null : countdownParts(new Date(target).getTime(), nowSeconds * 1000);
  const cells: { label: string; value: number | null }[] = [
    { label: "GÜN", value: parts?.days ?? null },
    { label: "SAAT", value: parts?.hours ?? null },
    { label: "DK", value: parts?.minutes ?? null },
    { label: "SN", value: parts?.seconds ?? null },
  ];

  return (
    <div role="timer" aria-label="Etkinliğe kalan süre" className="flex items-center gap-1.5 rounded-lg bg-slate-800/50 px-3 py-1.5">
      {cells.map((cell, index) => (
        <div key={cell.label} className="flex items-center gap-1.5">
          {index > 0 && (
            <span aria-hidden="true" className="font-bold text-emerald-500">
              :
            </span>
          )}
          <div className="text-center">
            <span className="block text-lg font-bold tabular-nums text-emerald-400">{pad(cell.value)}</span>
            <span className="block text-[9px] text-slate-500">{cell.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
