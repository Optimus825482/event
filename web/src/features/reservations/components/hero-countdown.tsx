"use client";

import { useEffect, useState } from "react";

const UNITS = ["GÜN", "SAAT", "DAKİKA", "SANİYE"] as const;

function remaining(target: number): number[] {
  const diff = Math.max(0, target - Date.now());
  return [
    Math.floor(diff / 86_400_000),
    Math.floor((diff % 86_400_000) / 3_600_000),
    Math.floor((diff % 3_600_000) / 60_000),
    Math.floor((diff % 60_000) / 1000),
  ];
}

/** Hero geri sayımı (eski `HeroCountdown`): gün, saat, dakika, saniye. */
export function HeroCountdown({ startsAt }: { startsAt: string }) {
  const target = new Date(startsAt).getTime();
  // Sunucu ve tarayıcı aynı ilk çıktıyı üretsin diye sıfırdan başlar; etkiyle güncellenir.
  const [values, setValues] = useState<number[]>([0, 0, 0, 0]);

  useEffect(() => {
    const tick = () => setValues(remaining(target));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [target]);

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4 md:justify-start md:gap-6" role="timer" aria-label="Etkinliğe kalan süre">
      {UNITS.map((label, i) => (
        <div key={label} className="flex items-center gap-2 sm:gap-4">
          <div className="text-center">
            <span className="block bg-gradient-to-b from-white via-purple-100 to-purple-300 bg-clip-text text-5xl font-bold tabular-nums text-transparent sm:text-6xl md:text-7xl">
              {String(values[i] ?? 0).padStart(2, "0")}
            </span>
            <span className="mt-2 block text-[10px] font-medium tracking-[0.2em] text-purple-300/80 sm:text-xs">{label}</span>
          </div>
          {i < UNITS.length - 1 ? <span className="-mt-6 text-3xl font-light text-purple-500/60 sm:text-4xl">:</span> : null}
        </div>
      ))}
    </div>
  );
}
