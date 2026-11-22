/** Bağlantı satırı: `owner` (ör. grup) → `value` (ör. masa). */
export type LinkRow = { id: string; owner: string; value: string };

/**
 * Mevcut bağlantı satırlarını istenen duruma getirmek için silinecek satır kimliklerini ve
 * eklenecek çiftleri hesaplar. Değişmeyen satırlar (ve kimlikleri) olduğu gibi kalır.
 */
export function diffLinks(
  existing: LinkRow[],
  desired: ReadonlyMap<string, readonly string[]>,
): { deleteIds: string[]; inserts: Array<{ owner: string; value: string }> } {
  const key = (owner: string, value: string) => `${owner}\u0000${value}`;
  const wanted = new Set<string>();
  for (const [owner, values] of desired) for (const value of values) wanted.add(key(owner, value));

  const kept = new Set<string>();
  const deleteIds: string[] = [];
  for (const row of existing) {
    const k = key(row.owner, row.value);
    if (wanted.has(k) && !kept.has(k)) kept.add(k);
    else deleteIds.push(row.id);
  }

  const inserts: Array<{ owner: string; value: string }> = [];
  for (const [owner, values] of desired) {
    for (const value of values) if (!kept.has(key(owner, value))) inserts.push({ owner, value });
  }
  return { deleteIds, inserts };
}

/**
 * Gelen kayıtlardan bu etkinlikte zaten var olan kimlikleri (`keep`: güncellenecek) ve
 * listede olmadığı için silinecek mevcut kimlikleri ayırır. Kalan kayıtlar eklenir.
 */
export function splitKept(
  incoming: ReadonlyArray<{ id?: string | undefined }>,
  existing: ReadonlyArray<{ id: string }>,
): { keep: Set<string>; deleteIds: string[] } {
  const existingIds = new Set(existing.map((r) => r.id));
  const keep = new Set(incoming.flatMap((r) => (r.id && existingIds.has(r.id) ? [r.id] : [])));
  return { keep, deleteIds: [...existingIds].filter((id) => !keep.has(id)) };
}

export function unique<T>(values: Iterable<T>): T[] {
  return [...new Set(values)];
}
