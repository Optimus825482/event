import { z } from "zod";
import { decorSchema, tableInputSchema } from "../schemas";
import type { DraftContent, EditorTable } from "./types";

/** Otomatik taslak kaydı aralığı (ms). */
export const DRAFT_INTERVAL_MS = 30_000;
const DRAFT_VERSION = 1;

/**
 * Taslak anahtarı etkinlik VE kullanıcı başına: paylaşılan cihazda bir kullanıcı diğerinin taslağını görmez.
 */
export function draftKey(eventId: string, userId: string): string {
  return `venue-draft-${eventId}:${userId}`;
}

export type StoredDraft = { savedAt: string; content: DraftContent };

const draftTableSchema = tableInputSchema.extend({
  key: z.string().min(1).max(128),
  id: z.uuid().nullable(),
  label: z.string().max(200),
  locked: z.boolean().default(false),
});

const draftSchema = z.object({
  version: z.literal(DRAFT_VERSION),
  eventId: z.string(),
  userId: z.string(),
  savedAt: z.iso.datetime(),
  tables: z.array(draftTableSchema).max(2000),
  decor: decorSchema,
});

export function serializeDraft(eventId: string, userId: string, content: DraftContent, now: Date): string {
  return JSON.stringify({
    version: DRAFT_VERSION,
    eventId,
    userId,
    savedAt: now.toISOString(),
    tables: content.tables,
    decor: { width: content.canvas.width, height: content.canvas.height, elements: content.elements },
  });
}

/** Bozuk, eski sürüm ya da başka etkinliğe/kullanıcıya ait taslak null döner. */
export function parseDraft(raw: string | null, eventId: string, userId: string): StoredDraft | null {
  if (!raw) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = draftSchema.safeParse(json);
  if (!parsed.success) return null;
  const d = parsed.data;
  if (d.eventId !== eventId || d.userId !== userId) return null;
  const tables: EditorTable[] = d.tables.map((t) => ({
    key: t.key,
    id: t.id,
    label: t.label,
    capacity: t.capacity,
    tableTypeId: t.tableTypeId,
    x: t.x,
    y: t.y,
    rotation: t.rotation,
    isLoca: t.isLoca,
    isVip: t.isVip,
    isPinned: t.isPinned,
    size: t.size,
    floor: t.floor,
    sortNumber: t.sortNumber,
    locked: t.locked,
  }));
  return {
    savedAt: d.savedAt,
    content: { tables, elements: d.decor.elements, canvas: { width: d.decor.width, height: d.decor.height } },
  };
}

export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** localStorage erişimi (gizli pencere, kota, engellenmiş depolama) hata verirse sessizce yok sayılır. */
export function readDraft(storage: DraftStorage | null, eventId: string, userId: string): StoredDraft | null {
  try {
    return parseDraft(storage?.getItem(draftKey(eventId, userId)) ?? null, eventId, userId);
  } catch {
    return null;
  }
}

export function writeDraft(
  storage: DraftStorage | null,
  eventId: string,
  userId: string,
  content: DraftContent,
  now: Date,
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(draftKey(eventId, userId), serializeDraft(eventId, userId, content, now));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(storage: DraftStorage | null, eventId: string, userId: string): void {
  try {
    storage?.removeItem(draftKey(eventId, userId));
  } catch {
    // Depolama erişilemiyorsa silinecek taslak da yoktur.
  }
}

/** "14:32" (saat:dakika, iki haneli). */
export function formatDraftTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "22.11.2026 14:32:05". */
export function formatDraftStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
