// Yük betiğinin saf mantığı: tutma planı ve sonuç değerlendirmesi (ağ/süreç yok).
import { randomUUID } from "node:crypto";

const EXPECTED_REJECTIONS = new Set(["seats_unavailable", "leaves_single_seat"]);

/**
 * @param {{ tables: { id: string; free: number }[]; count: number; random: () => number }} input
 * @returns {{ tableId: string; quantity: number; clientKey: string; clientIp: string }[]}
 */
export function planHolds({ tables, count, random }) {
  if (tables.length === 0) return [];
  const plan = [];
  for (let i = 0; i < count; i++) {
    const table = tables[Math.floor(random() * tables.length)];
    const quantity = 2 + Math.floor(random() * 3);
    // 10.x.y.z: i'den türetilir; her tutma ayrı IP'dir (üst sınır 2^24 tutma).
    const clientIp = `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`;
    plan.push({ tableId: table.id, quantity, clientKey: randomUUID(), clientIp });
  }
  return plan;
}

/**
 * @param {{
 *   initialFree: Record<string, number>; finalFree: Record<string, number>;
 *   holds: { tableId: string; quantity: number; status: number; code: string | null }[];
 *   availabilityHits: number; durationMs: number; pollTotal: number; pollErrors: number;
 * }} input
 */
export function summarize({ initialFree, finalFree, holds, availabilityHits, durationMs, pollTotal, pollErrors }) {
  const violations = [];
  const heldByTable = {};
  const rejectedByCode = {};
  let held = 0;
  for (const h of holds) {
    if (h.status >= 200 && h.status < 300) {
      heldByTable[h.tableId] = (heldByTable[h.tableId] ?? 0) + h.quantity;
      held += h.quantity;
    } else if (h.code !== null && EXPECTED_REJECTIONS.has(h.code)) {
      rejectedByCode[h.code] = (rejectedByCode[h.code] ?? 0) + 1;
    } else {
      violations.push(`beklenmeyen yanıt: ${h.status} ${h.code}`);
    }
  }
  for (const [tableId, free] of Object.entries(initialFree)) {
    const taken = heldByTable[tableId] ?? 0;
    if (taken > free) violations.push(`çifte satış: ${tableId}`);
    if (free - taken !== finalFree[tableId]) violations.push(`doluluk tutarsız: ${tableId}`);
  }
  if (availabilityHits > Math.ceil(durationMs / 2000) + 1) violations.push("çekirdeğe giden doluluk isteği sınırı aştı");
  const pollErrorRate = pollTotal > 0 ? pollErrors / pollTotal : 0;
  if (pollErrorRate > 0.01) violations.push("sorgulama hata oranı %1'i aştı");
  return {
    ok: violations.length === 0,
    violations: [...new Set(violations)],
    held,
    rejectedByCode,
    availabilityPerSecond: durationMs > 0 ? availabilityHits / (durationMs / 1000) : 0,
    pollErrorRate,
  };
}
