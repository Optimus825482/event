/**
 * Sound Feedback Utility - Sesli geri bildirim
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 *
 * Web Audio API kullanarak beep sesleri üretir.
 * Harici ses dosyası gerektirmez - 404 hatası olmaz.
 */

export type SoundType = "success" | "error" | "vip" | "warning";

// Beep sound configurations
const BEEP_CONFIG: Record<
  SoundType,
  {
    freq: number;
    duration: number;
    type: OscillatorType;
    secondNote?: { freq: number; delay: number };
  }
> = {
  success: { freq: 880, duration: 150, type: "sine" },
  error: {
    freq: 220,
    duration: 300,
    type: "square",
    secondNote: { freq: 180, delay: 200 },
  },
  vip: {
    freq: 1200,
    duration: 200,
    type: "sine",
    secondNote: { freq: 1400, delay: 150 },
  },
  warning: { freq: 440, duration: 200, type: "triangle" },
};

let audioContext: AudioContext | null = null;

/**
 * AudioContext'i başlat
 */
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioContext;
}

/**
 * Web Audio API ile beep sesi çal
 */
function playBeep(type: SoundType): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const config = BEEP_CONFIG[type];
    const { freq, duration, type: oscType, secondNote } = config;

    // İlk nota
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = oscType;
    oscillator.frequency.setValueAtTime(freq, ctx.currentTime);

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      ctx.currentTime + duration / 1000
    );

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration / 1000);

    // İkinci nota (varsa)
    if (secondNote) {
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = oscType;
        osc2.frequency.setValueAtTime(secondNote.freq, ctx.currentTime);
        gain2.gain.setValueAtTime(0.3, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.15);
      }, secondNote.delay);
    }
  } catch {
    // Sessizce geç
  }
}

/**
 * Ses çal
 */
export async function playSound(type: SoundType): Promise<void> {
  if (typeof window === "undefined") return;
  playBeep(type);
}

/**
 * Preload - Web Audio API için gerekli değil ama API uyumluluğu için tutuluyor
 */
export async function preloadSounds(): Promise<void> {
  // Web Audio API kullanıldığı için preload gerekmiyor
  getAudioContext();
}

/**
 * Ses desteği kontrolü
 */
export function isSoundSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window.AudioContext || (window as any).webkitAudioContext);
}

/**
 * Vibration API ile titreşim (mobil)
 */
export function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

/**
 * Check-in sonucu için feedback
 */
export function checkInFeedback(
  type: "success" | "vip" | "blacklist" | "duplicate" | "error",
  enableSound = true,
  enableVibration = true
): void {
  if (enableSound) {
    switch (type) {
      case "success":
        playSound("success");
        break;
      case "vip":
        playSound("vip");
        break;
      case "blacklist":
      case "duplicate":
        playSound("warning");
        break;
      case "error":
        playSound("error");
        break;
    }
  }

  if (enableVibration) {
    switch (type) {
      case "success":
        vibrate(100);
        break;
      case "vip":
        vibrate([100, 50, 100]);
        break;
      case "blacklist":
        vibrate([200, 100, 200]);
        break;
      case "duplicate":
        vibrate([100, 100, 100]);
        break;
      case "error":
        vibrate([300, 100, 300]);
        break;
    }
  }
}
