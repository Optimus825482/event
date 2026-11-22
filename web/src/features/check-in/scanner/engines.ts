/** Kamera okuyucu motorları: yerel `BarcodeDetector` (tercih) ve `html5-qrcode` (yalnızca yedek). */

export type StopScanner = () => void;
export type OnCode = (code: string) => void;

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = { detect(source: HTMLVideoElement): Promise<DetectedBarcode[]> };
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

const DETECT_INTERVAL_MS = 150;

export function getBarcodeDetector(): BarcodeDetectorCtor | null {
  const ctor = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return typeof ctor === "function" ? ctor : null;
}

function stopStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}

export async function startNativeScanner(
  video: HTMLVideoElement,
  Detector: BarcodeDetectorCtor,
  onCode: OnCode,
): Promise<StopScanner> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("mediaDevices insecure context");
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } },
    audio: false,
  });
  try {
    video.srcObject = stream;
    video.muted = true;
    await video.play();
  } catch (error) {
    stopStream(stream);
    throw error;
  }
  const detector = new Detector({ formats: ["qr_code"] });
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = async () => {
    if (stopped) return;
    try {
      if (video.readyState >= 2) {
        for (const barcode of await detector.detect(video)) if (barcode.rawValue) onCode(barcode.rawValue);
      }
    } catch {
      // tek karelik okuma hatası: bir sonraki kareyi dene
    }
    if (!stopped) timer = setTimeout(() => void tick(), DETECT_INTERVAL_MS);
  };
  void tick();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    stopStream(stream);
    video.srcObject = null;
  };
}

export async function startFallbackScanner(elementId: string, onCode: OnCode): Promise<StopScanner> {
  const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
  const scanner = new Html5Qrcode(elementId, {
    verbose: false,
    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
  });
  await scanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 240, height: 240 } },
    (text) => onCode(text),
    () => undefined,
  );
  return () => {
    void (async () => {
      try {
        if (scanner.isScanning) await scanner.stop();
        scanner.clear();
      } catch {
        // zaten durmuş
      }
    })();
  };
}
