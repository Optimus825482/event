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

export type ThreeDUnavailableReason = "no_webgl" | "save_data" | "low_spec";

/** 3B görünüm neden sunulamıyor? Sunulabiliyorsa `null` döner. */
export function unavailable3dReason(env: DeviceEnv): ThreeDUnavailableReason | null {
  if (!env.webgl) return "no_webgl";
  if (env.saveData === true) return "save_data";
  if (env.deviceMemory !== undefined && env.deviceMemory < MIN_MEMORY_GB) return "low_spec";
  if (env.hardwareConcurrency !== undefined && env.hardwareConcurrency < MIN_CORES) return "low_spec";
  return null;
}

/** 3B görünüm sunulur mu? Bilinmeyen değer (ör. Safari'de deviceMemory yok) engel sayılmaz; hareket azaltmada animasyonsuz açılır. */
export function canOffer3d(env: DeviceEnv): boolean {
  return unavailable3dReason(env) === null;
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

let cachedReason: ThreeDUnavailableReason | null | undefined;

/** Sonuç sayfa ömrü boyunca önbelleklenir (WebGL bağlamı yoklaması pahalıdır). */
export function detect3dReason(): ThreeDUnavailableReason | null {
  if (cachedReason === undefined) {
    cachedReason = unavailable3dReason(readDeviceEnv());
  }
  return cachedReason;
}

/** 3B görünümün sunulup sunulamayacağını önbellekli döndürür. */
export function detectCanOffer3d(): boolean {
  return detect3dReason() === null;
}
