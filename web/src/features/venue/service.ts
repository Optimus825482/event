import { eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { eventTables, events, tableTypes, venueTemplates } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { getEventOrThrow, listEventTables, totalCapacity } from "@/features/events/service";
import { DomainError } from "@/lib/action";
import {
  assertEventAccess,
  isLayoutEditable,
  lockEditableEvent,
  mapLayoutDbError,
  tablesInUse,
  writeLayout,
  type EventTableRow,
  type WriteLayoutResult,
} from "./layout-core";
import {
  normalizeLabel,
  parseDecor,
  type ApplyTemplateInput,
  type Decor,
  type DecorInput,
  type SaveAsTemplateInput,
  type TableInput,
  type TemplateLayout,
} from "./schemas";
import { parseTemplateLayout } from "./template-layout";
import { assertTemplateVisible, getTemplateOrThrow } from "./templates-service";

export type { EventTableRow } from "./layout-core";

export type SaveLayoutServiceInput = { eventId: string; tables: TableInput[]; decor: DecorInput };

/**
 * Yerleşimi tek transaction'da kaydeder: kimlikli masalar güncellenir, kimliksizler eklenir,
 * girdide olmayanlar silinir. Kullanımdaki (rezervasyon/atama/grup) bir masa silinmek istenirse
 * hiçbir değişiklik yazılmaz ve `conflict` mesajı masa etiketlerini listeler.
 * `events.total_capacity` aynı transaction'da masalardan yeniden hesaplanır.
 */
export async function saveLayout(db: Db, actor: Actor, input: SaveLayoutServiceInput): Promise<WriteLayoutResult> {
  try {
    return await db.transaction(async (tx) => {
      await lockEditableEvent(tx, actor, input.eventId);
      return writeLayout(tx, input.eventId, input.tables, input.decor);
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    return mapLayoutDbError(error);
  }
}

export type VenueLayout = {
  event: { id: string; name: string; status: (typeof events.$inferSelect)["status"]; venueTemplateId: string | null };
  tables: EventTableRow[];
  decor: Decor;
  /** Silinemeyen (rezervasyonu/ataması olan) masalar. */
  lockedTableIds: string[];
  editable: boolean;
  totalCapacity: number;
};

export async function getVenueLayout(db: Db, actor: Actor, eventId: string): Promise<VenueLayout> {
  const event = await getEventOrThrow(db, eventId);
  assertEventAccess(actor, event);
  const tables = await listEventTables(db, eventId);
  const used = await tablesInUse(
    db,
    eventId,
    tables.map((t) => t.id),
  );
  return {
    event: { id: event.id, name: event.name, status: event.status, venueTemplateId: event.venueTemplateId },
    tables,
    decor: parseDecor(event.layoutDecor),
    lockedTableIds: tables.filter((t) => used.has(t.id)).map((t) => t.id),
    editable: isLayoutEditable(event),
    totalCapacity: await totalCapacity(db, eventId),
  };
}

export type ApplyTemplateResult = WriteLayoutResult & {
  /** Kullanımda olduğu için korunan mevcut masalar. */
  keptLabels: string[];
  /** Korunan bir masayla aynı etikete sahip olduğu için eklenmeyen şablon masaları. */
  skippedLabels: string[];
};

/**
 * Şablonu etkinliğe uygular. Rezervasyonu/ataması olan mevcut masalar korunur (konumları dahil);
 * diğer masalar silinir ve şablon masaları eklenir. Korunan masayla etiketi çakışan şablon masası
 * atlanır. Dekor şablondakiyle değiştirilir; şablonun kullanım sayısı artar.
 */
export async function applyVenueTemplate(db: Db, actor: Actor, input: ApplyTemplateInput): Promise<ApplyTemplateResult> {
  try {
    return await db.transaction(async (tx) => {
      await lockEditableEvent(tx, actor, input.eventId);
      const template = await getTemplateOrThrow(tx, input.templateId);
      assertTemplateVisible(actor, template);
      const layout = parseTemplateLayout(template.layoutData);

      const existing = await listEventTables(tx, input.eventId);
      const used = await tablesInUse(
        tx,
        input.eventId,
        existing.map((t) => t.id),
      );
      const kept = existing.filter((t) => used.has(t.id));
      const keptKeys = new Set(kept.map((t) => normalizeLabel(t.label)));
      const knownTypes = await existingTableTypeIds(tx, layout);

      const skippedLabels: string[] = [];
      const fromTemplate: TableInput[] = [];
      for (const t of layout.tables) {
        if (keptKeys.has(normalizeLabel(t.label))) {
          skippedLabels.push(t.label);
          continue;
        }
        fromTemplate.push({ ...t, tableTypeId: t.tableTypeId && knownTypes.has(t.tableTypeId) ? t.tableTypeId : null });
      }
      const keptInputs: TableInput[] = kept.map((t) => ({
        id: t.id,
        label: t.label,
        capacity: t.capacity,
        tableTypeId: t.tableTypeId,
        x: t.x,
        y: t.y,
        rotation: t.rotation,
        isLoca: t.isLoca,
      }));

      const result = await writeLayout(tx, input.eventId, [...keptInputs, ...fromTemplate], layout.decor);
      await tx
        .update(events)
        .set({ venueTemplateId: template.id })
        .where(eq(events.id, input.eventId));
      await tx
        .update(venueTemplates)
        .set({ usageCount: sql`${venueTemplates.usageCount} + 1` })
        .where(eq(venueTemplates.id, template.id));
      return { ...result, keptLabels: kept.map((t) => t.label), skippedLabels };
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    return mapLayoutDbError(error);
  }
}

async function existingTableTypeIds(tx: Pick<Db, "select">, layout: TemplateLayout): Promise<Set<string>> {
  const ids = layout.tables.map((t) => t.tableTypeId).filter((id): id is string => id !== null);
  if (ids.length === 0) return new Set();
  const rows = await tx
    .select({ id: tableTypes.id })
    .from(tableTypes)
    .where(inArray(tableTypes.id, [...new Set(ids)]));
  return new Set(rows.map((r) => r.id));
}

/** Etkinliğin mevcut masalarını ve dekorunu yeni bir şablon olarak kaydeder (sahibi işlemi yapan). */
export async function saveAsTemplate(db: Db, actor: Actor, input: SaveAsTemplateInput) {
  const event = await getEventOrThrow(db, input.eventId);
  assertEventAccess(actor, event);
  const tables = await db
    .select()
    .from(eventTables)
    .where(eq(eventTables.eventId, input.eventId))
    .orderBy(eventTables.label);
  const layoutData: TemplateLayout = {
    version: 1,
    tables: tables.map((t) => ({
      label: t.label,
      capacity: t.capacity,
      tableTypeId: t.tableTypeId,
      x: t.x,
      y: t.y,
      rotation: t.rotation,
      isLoca: t.isLoca,
    })),
    decor: parseDecor(event.layoutDecor),
  };
  const [row] = await db
    .insert(venueTemplates)
    .values({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      isPublic: input.isPublic ?? false,
      layoutData,
      createdById: actor.id,
    })
    .returning();
  if (!row) throw new Error("şablon eklenemedi");
  return row;
}
