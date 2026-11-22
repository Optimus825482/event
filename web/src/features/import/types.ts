/** Onay sonrası satır sonucu (rezervasyon ve atama içe aktarmada ortak). */
export type ImportRowResult = { row: number; status: "created" | "skipped"; message: string };

/** Önizleme satırı: `summary` kullanıcıya gösterilen kısa özet. Hiçbir şey yazılmamıştır. */
export type PreviewRow = { row: number; status: "ok" | "error"; message: string; summary: string };

export type PreviewResult = { rows: PreviewRow[]; okCount: number; errorCount: number };
