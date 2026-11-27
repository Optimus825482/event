export type DeviceEnv = {
  webgl: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  saveData?: boolean;
  reducedMotion: boolean;
};

/**
 * Yalnızca gerçekten zayıf cihaz elenir: Chrome `deviceMemory`'yi 2'nin kuvvetine yuvarlar (6 GB → 4, 3 GB → 2),
 * gizlilik kipindeki tarayıcılar `hardwareConcurrency` için 2 bildirir; bunlar 3B salonu rahat çizer.
 */
const MIN_MEMORY_GB = 2;
const MIN_CORES = 2;

/** 3B görünüm sunulur mu? Bilinmeyen değer (ör. Safari'de deviceMemory yok) engel sayılmaz. */
export function canOffer3d(env: DeviceEnv): boolean {
  if (!env.webgl || env.reducedMotion || env.saveData === true) return false;
  if (env.deviceMemory !== undefined && env.deviceMemory < MIN_MEMORY_GB) return false;
  if (env.hardwareConcurrency !== undefined && env.hardwareConcurrency < MIN_CORES) return false;
  return true;
}

type NavigatorHints = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };

function hasWebgl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Tarayıcıdan cihaz ipuçlarını okur (yalnızca istemcide çağrılır). */
export function readDeviceEnv(): DeviceEnv {
  const nav = navigator as NavigatorHints;
  return {
    webgl: hasWebgl(),
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    saveData: nav.connection?.saveData,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

let cached: boolean | undefined;

/** Sonuç sayfa ömrü boyunca önbelleklenir (WebGL bağlamı yoklaması pahalıdır). */
export function detectCanOffer3d(): boolean {
  cached ??= canOffer3d(readDeviceEnv());
  return cached;
}
