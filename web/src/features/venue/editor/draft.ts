import { z } from "zod";
import { APP_TIME_ZONE, dateToZonedWallClock } from "@/lib/time-zone";
import { decorSchema, tableInputSchema } from "../schemas";
import { linesForSave } from "./lines";
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
    decor: {
      width: content.canvas.width,
      height: content.canvas.height,
      elements: content.elements,
      ...(content.lines ? { lines: linesForSave(content.lines, content.canvas) } : {}),
    },
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
    content: {
      tables,
      elements: d.decor.elements,
      ...(d.decor.lines ? { lines: d.decor.lines } : {}),
      canvas: { width: d.decor.width, height: d.decor.height },
    },
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

/** "14:32" (saat:dakika, iki haneli; Kıbrıs saati). */
export function formatDraftTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return dateToZonedWallClock(d, APP_TIME_ZONE).slice(11);
}

/** "22.11.2026 14:32:05" (Kıbrıs saati). */
export function formatDraftStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const wall = dateToZonedWallClock(d, APP_TIME_ZONE);
  const [y, m, day] = wall.slice(0, 10).split("-");
  // Bölge ofsetleri tam dakikadır; saniye UTC ile aynıdır.
  return `${day}.${m}.${y} ${wall.slice(11)}:${String(d.getUTCSeconds()).padStart(2, "0")}`;
}
