/** Kapı numaraları: saf ve istemcide de çalışır. Sunucu 1–9 kabul eder; arayüz yalnızca bu kadar kapı sunar. */
export const CHECK_IN_GATE_COUNT = 3;

export const CHECK_IN_GATES: readonly number[] = Array.from({ length: CHECK_IN_GATE_COUNT }, (_, i) => i + 1);

/** Cihazın seçili kapısı etkinlikten bağımsız bu anahtarda saklanır. */
export const GATE_STORAGE_KEY = "eventflow.check-in.gate";

export function gateLabel(gate: number): string {
  return `Kapı ${gate}`;
}

/** 1…`CHECK_IN_GATE_COUNT` tam sayı ya da onun metni; diğer her şey `null`. */
export function parseGate(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && /^\d+$/.test(raw.trim()) ? Number(raw) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= CHECK_IN_GATE_COUNT ? n : null;
}
