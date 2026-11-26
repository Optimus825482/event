/** 3B balo salonu sahnesinin saf yerleşim hesapları (three.js'e bağımlı değildir; testle doğrulanır). */

export const MAX_CHAIRS = 16;

export type ChairPlacement = { x: number; z: number; rotationY: number };

/**
 * Masa gövdesi plandaki alanının bu oranında çizilir; sandalye halkasıyla birlikte tam o alana sığar
 * (0.6625 x çap = alanın yarısı), böylece komşu masalar iç içe girmez.
 */
export const TABLE_BODY_SCALE = 0.75;

/** Sandalye küpünün kenarı: masa çapının sekizde biri (çap 2.4 iken 0.3). */
export function chairSize(tableWidth: number, tableDepth: number): number {
  return Math.min(0.3, Math.max(0.04, Math.min(tableWidth, tableDepth) * 0.125));
}

/** Masa yüksekliği çapla orantılıdır (çap 2.4 iken 0.78); büyük masalarda gerçek masa boyunda kalır. */
export function tableHeight(tableWidth: number, tableDepth: number): number {
  return Math.min(0.78, Math.min(tableWidth, tableDepth) * 0.325);
}

/**
 * Masanın çevresine (elips üzerinde) eşit aralıklı sandalyeler; konumlar masa merkezine görelidir.
 * `rotationDeg` masanın tuvaldeki dönüşüdür (saat yönü). Sayı `MAX_CHAIRS` ile sınırlanır.
 */
export function chairPlacements(tableWidth: number, tableDepth: number, rotationDeg: number, count: number): ChairPlacement[] {
  const n = Math.max(0, Math.min(MAX_CHAIRS, Math.floor(count)));
  if (n === 0) return [];
  const gap = chairSize(tableWidth, tableDepth) * 0.8;
  const rx = tableWidth / 2 + gap;
  const rz = tableDepth / 2 + gap;
  const rot = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const lx = Math.cos(a) * rx;
    const lz = Math.sin(a) * rz;
    return { x: lx * cos - lz * sin, z: lx * sin + lz * cos, rotationY: -(a + rot) };
  });
}

export type CameraPresetId = "overview" | "stage" | "loca" | "top";
export type CameraPreset = { id: CameraPresetId; label: string; position: [number, number, number]; target: [number, number, number] };

type Point = { x: number; z: number; y?: number };

/**
 * Kamera açıları. `stage` sahne varsa, `loca` loca varsa üretilir.
 * Salon `width` x `depth` birimdir ve orijinde ortalıdır.
 */
export function cameraPresets(width: number, depth: number, stage: Point | null, loca: Point | null): CameraPreset[] {
  const span = Math.max(width, depth, 4);
  const presets: CameraPreset[] = [
    { id: "overview", label: "Genel Bakış", position: [0, span * 0.46, depth / 2 + span * 0.22], target: [0, 0.6, 0] },
  ];
  if (stage) {
    // Salonun ortasından sahneye doğru, göz hizasının biraz üstünden.
    const dx = -stage.x;
    const dz = -stage.z;
    const len = Math.hypot(dx, dz) || 1;
    const back = Math.max(span * 0.3, 4);
    presets.push({
      id: "stage",
      label: "Sahne Önü",
      position: [stage.x + (dx / len) * back, Math.max(2.4, span * 0.1), stage.z + (dz / len) * back],
      target: [stage.x, 1.2, stage.z],
    });
  }
  if (loca) {
    const target: [number, number, number] = stage ? [stage.x, 1.2, stage.z] : [0, 0.6, 0];
    presets.push({ id: "loca", label: "Loca Balkonu", position: [loca.x, (loca.y ?? 0) + 2.6, loca.z], target });
  }
  presets.push({ id: "top", label: "Kuş Bakışı", position: [0, span * 1.05, 0.01], target: [0, 0, 0] });
  return presets;
}

/** Avizeler: salonun genişliği boyunca eşit aralıklı, en fazla üç adet. */
export function chandelierPositions(width: number): number[] {
  if (width < 8) return [0];
  if (width < 20) return [-width / 4, width / 4];
  return [-width / 3.2, 0, width / 3.2];
}
