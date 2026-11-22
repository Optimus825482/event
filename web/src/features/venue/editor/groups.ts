/** Ekip masa grubu: planda masanın çevresine grup renginde halka çizilir. */
export type TableGroupInfo = { tableId: string; name: string; color: string };
export type GroupBadge = { name: string; color: string };

const HEX = /^#[0-9a-f]{6}$/i;
export const FALLBACK_GROUP_COLOR = "#3b82f6";

/** Geçersiz renk değeri (veritabanında serbest metin) halkayı bozmasın diye varsayılana düşer. */
export function safeGroupColor(color: string | null | undefined): string {
  return color && HEX.test(color) ? color : FALLBACK_GROUP_COLOR;
}

/** Masa kimliği → grup rozeti. Bir masa tek gruba aittir; çakışmada ilk kayıt kazanır. */
export function groupsByTable(rows: readonly TableGroupInfo[]): Map<string, GroupBadge> {
  const out = new Map<string, GroupBadge>();
  for (const r of rows) {
    if (!out.has(r.tableId)) out.set(r.tableId, { name: r.name, color: safeGroupColor(r.color) });
  }
  return out;
}

/** Açıklama için tekil gruplar (ada göre, aynı ad+renk bir kez). */
export function distinctGroups(badges: Iterable<GroupBadge>): GroupBadge[] {
  const seen = new Map<string, GroupBadge>();
  for (const b of badges) seen.set(`${b.name}|${b.color}`, b);
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "tr"));
}
