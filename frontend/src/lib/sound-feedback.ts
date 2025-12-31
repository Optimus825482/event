/**
 * Sound Feedback Utility - Sesli geri bildirim
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

export type SoundType = "success" | "error" | "vip" | "warning";

// Audio cache
const audioCache: Map<SoundType, HTMLAudioElement> = new Map();

// Sound file paths
const SOUND_PATHS: Record<SoundType, string> = {
  success: "/sounds/success.mp3",
  error: "/sounds/error.mp3",
  vip: "/sounds/vip.mp3",
  warning: "/sounds/warning.mp3",
};

// Fallback: Web Audio API beep sounds
const BEEP_FREQUENCIES: Record<
  SoundType,
  { freq: number; duration: number; type: OscillatorType }
> = {
  success: { freq: 880, duration: 150, type: "sine" },
  error: { freq: 220, duration: 300, type: "square" },
  vip: { freq: 1200, duration: 200, type: "sine" },
  warning: { freq: 440, duration: 200, type: "triangle" },
};

let audioContext: AudioContext | null = null;

/**
 * AudioContext'i başlat (user interaction sonrası)
 */
function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Web Audio API ile beep sesi çal
 */
function playBeep(type: SoundType): void {
  try {
    const ctx = getAudioContext();
    const { freq, duration, type: oscType } = BEEP_FREQUENCIES[type];

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = oscType;
    oscillator.frequency.setValueAtTime(freq, ctx.currentTime);

    // Fade out
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      ctx.currentTime + duration / 1000
    );

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration / 1000);

    // VIP için ikinci nota
    if (type === "vip") {
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(1400, ctx.currentTime);
        gain2.gain.setValueAtTime(0.3, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.15);
      }, 150);
    }

    // Error için ikinci nota (düşük)
    if (type === "error") {
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = "square";
        osc2.frequency.setValueAtTime(180, ctx.currentTime);
        gain2.gain.setValueAtTime(0.2, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.2);
      }, 200);
    }
  } catch (err) {
    console.warn("[SoundFeedback] Beep error:", err);
  }
}

/**
 * Ses dosyasını yükle ve cache'le
 */
async function loadSound(type: SoundType): Promise<HTMLAudioElement | null> {
  if (audioCache.has(type)) {
    return audioCache.get(type)!;
  }

  try {
    const audio = new Audio(SOUND_PATHS[type]);
    audio.preload = "auto";

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout loading ${type} sound`));
      }, 3000);

      audio.oncanplaythrough = () => {
        clearTimeout(timeout);
        resolve();
      };
      audio.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to load ${type} sound`));
      };
      audio.load();
    });

    audioCache.set(type, audio);
    return audio;
  } catch {
    // Sessizce fallback'e geç - console spam önlenir
    return null;
  }
}

/**
 * Ses çal
 */
export async function playSound(type: SoundType): Promise<void> {
  // Browser check
  if (typeof window === "undefined") return;

  try {
    // Try to play audio file first
    const audio = await loadSound(type);

    if (audio) {
      audio.currentTime = 0;
      await audio.play();
    } else {
      // Fallback to beep
      playBeep(type);
    }
  } catch (err) {
    // Fallback to beep on any error
    playBeep(type);
  }
}

/**
 * Tüm sesleri önceden yükle (sessizce - hata vermez)
 */
export async function preloadSounds(): Promise<void> {
  // Browser check
  if (typeof window === "undefined") return;

  const types: SoundType[] = ["success", "error", "vip", "warning"];

  // Sessizce yükle - 404 hataları console'a yazılmaz
  await Promise.allSettled(types.map((type) => loadSound(type)));
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
        playSound("warning");
        break;
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
