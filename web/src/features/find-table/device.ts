export type DeviceHints = {
  webgl: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  saveData?: boolean;
  reducedMotion?: boolean;
};

const MIN_MEMORY_GB = 4;
const MIN_CORES = 4;

/** 3B yalnızca güçlü olduğu bilinen ya da bildirmeyen, tasarruf/hareket kısıtı olmayan cihazlara sunulur. */
export function canOffer3d(h: DeviceHints): boolean {
  if (!h.webgl || h.saveData || h.reducedMotion) return false;
  if (h.deviceMemory !== undefined && h.deviceMemory < MIN_MEMORY_GB) return false;
  if (h.hardwareConcurrency !== undefined && h.hardwareConcurrency < MIN_CORES) return false;
  return true;
}

type NavigatorHints = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };

function hasWebgl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Yalnızca tarayıcıda çağrılır. */
export function readDeviceHints(): DeviceHints {
  if (typeof window === "undefined") return { webgl: false };
  const nav = navigator as NavigatorHints;
  return {
    webgl: hasWebgl(),
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    saveData: nav.connection?.saveData === true,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}
