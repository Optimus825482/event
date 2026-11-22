"use client";

import { Camera, CameraOff } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { describeCameraError } from "./camera-errors";
import { getBarcodeDetector, startFallbackScanner, startNativeScanner, type StopScanner } from "./engines";
import { createScanDeduper } from "./scan-dedupe";

type Status = "idle" | "starting" | "active" | "error";

/**
 * Kamera ile QR okuyucu (eski `qr-scanner.tsx`'in karşılığı). Yerel `BarcodeDetector` varsa onu,
 * yoksa `html5-qrcode`'u kullanır. Kamera yalnızca kullanıcı isteğiyle açılır; bileşen
 * kaldırılınca ve sekme gizlenince akış durdurulur (görünür olunca kullanıcı açıksa sürer).
 * Aynı kod 4 sn içinde tekrar okunursa yok sayılır. İzin reddi/kamera yoksa mesaj gösterilir;
 * manuel giriş yolu etkilenmez. Okunan metin `onScan` ile `parseScannedCode` hattına verilir.
 */
export function CameraScanner({ onScan, disabled = false }: { onScan: (code: string) => void; disabled?: boolean }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<StopScanner | null>(null);
  const generation = useRef(0);
  const wantActive = useRef(false);
  const deduper = useRef(createScanDeduper());
  const onScanRef = useRef(onScan);
  const fallbackId = `qr-fallback-${useId().replace(/:/g, "")}`;
  // Sunucuda false, tarayıcıda gerçek değer (hidrasyon uyuşmazlığı olmadan).
  const native = useSyncExternalStore(
    () => () => undefined,
    () => getBarcodeDetector() !== null,
    () => false,
  );

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const stop = useCallback(() => {
    generation.current += 1;
    stopRef.current?.();
    stopRef.current = null;
  }, []);

  const start = useCallback(async () => {
    stop();
    const mine = generation.current;
    wantActive.current = true;
    setError(null);
    setStatus("starting");
    const handle = (code: string) => {
      if (deduper.current.accept(code, Date.now())) onScanRef.current(code);
    };
    try {
      const Detector = getBarcodeDetector();
      const video = videoRef.current;
      const stopper =
        Detector && video ? await startNativeScanner(video, Detector, handle) : await startFallbackScanner(fallbackId, handle);
      if (mine !== generation.current) {
        stopper(); // bekleme sırasında kapatıldı/kaldırıldı
        return;
      }
      stopRef.current = stopper;
      setStatus("active");
    } catch (cause) {
      if (mine !== generation.current) return;
      wantActive.current = false;
      setError(describeCameraError(cause));
      setStatus("error");
    }
  }, [fallbackId, stop]);

  const close = useCallback(() => {
    wantActive.current = false;
    stop();
    setStatus("idle");
  }, [stop]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        stop(); // istenen durum (wantActive) korunur: görünür olunca yeniden açılır
        setStatus("idle");
      } else if (wantActive.current) {
        void start();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      wantActive.current = false;
      stop();
    };
  }, [start, stop]);

  const open = status === "active" || status === "starting";
  return (
    <section aria-label="Kamera ile QR okuma" className="space-y-2">
      <div className="flex items-center gap-2">
        {open ? (
          <Button type="button" variant="outline" size="lg" onClick={close}>
            <CameraOff /> Kamerayı kapat
          </Button>
        ) : (
          <Button type="button" variant="outline" size="lg" onClick={() => void start()} disabled={disabled}>
            <Camera /> Kamerayla tara
          </Button>
        )}
        <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
          {status === "starting" ? "Kamera açılıyor…" : status === "active" ? "Kamera açık; QR kodu gösterin" : ""}
        </p>
      </div>
      {error ? (
        <p role="alert" className="rounded-md border border-amber-500 bg-amber-50 p-3 text-sm text-amber-900">
          {error}
        </p>
      ) : null}
      <div className={open ? "max-w-sm overflow-hidden rounded-lg border border-border bg-black" : "hidden"}>
        <video ref={videoRef} playsInline muted aria-label="Kamera görüntüsü" className={native ? "w-full" : "hidden"} />
        <div id={fallbackId} className={native ? "hidden" : "w-full"} />
      </div>
    </section>
  );
}
