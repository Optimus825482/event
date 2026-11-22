import * as schema from "@/db/schema";
import { EVENT_STATUSES, type EventStatus } from "@/domain/event-status";
import { normalizeLabel } from "@/features/venue/schemas";
import { timestamps } from "./catalogs";
import type { Ctx } from "./context";
import { parseLayout } from "./layout";
import { byCreatedThenId, isUuid, type Row, stableId, toTime, uniqueName } from "./values";

/**
 * Mekân şablonları, etkinlikler, `venueLayout` → `event_tables` + `events.layout_decor`,
 * hizmet noktaları ve vardiyalar. Masa kimlikleri eski yerleşimde uuid değildir ve şablondan
 * kopyalanan etkinliklerde tekrar eder; yeni kimlik `stableId(eventId, eskiMasaKimliği)` ile
 * deterministik üretilir (aynı eski veri → aynı kimlik; rapordaki eşleme tablosu izlenebilir).
 */

function isEventStatus(value: string | null): value is EventStatus {
  return value !== null && (EVENT_STATUSES as readonly string[]).includes(value);
}

/** Organizatörsüz etkinliklere atanacak kullanıcı: seçenek → en eski etkin admin → admin → organizer → herhangi biri. */
function defaultOrganizer(ctx: Ctx): string | null {
  const wanted = ctx.options.defaultOrganizerId;
  if (wanted !== undefined) {
    if (!ctx.userIds.has(wanted)) throw new Error(`--default-organizer eski kullanıcılarda yok: ${wanted}`);
    return wanted;
  }
  const users = [...ctx.legacy.users].sort(byCreatedThenId);
  const pick = (f: (u: Row) => boolean) => users.find(f)?.id ?? null;
  return (
    pick((u) => u.str("role") === "admin" && u.bool("isActive", true)) ??
    pick((u) => u.str("role") === "admin") ??
    pick((u) => u.str("role") === "organizer") ??
    pick(() => true)
  );
}

function tableTypeResolver(ctx: Ctx): (ref: string | null) => string | null {
  const byName = new Map<string, string>();
  for (const t of ctx.legacy.table_types) byName.set(t.text("name").trim().toLocaleLowerCase("tr"), t.id);
  return (ref) => {
    if (ref === null) return null;
    if (isUuid(ref) && ctx.tableTypeIds.has(ref.toLowerCase())) return ref.toLowerCase();
    return byName.get(ref.trim().toLocaleLowerCase("tr")) ?? null;
  };
}

export async function migrateEvents(ctx: Ctx): Promise<void> {
  const L = ctx.legacy;
  await ctx.w.insert(
    schema.venueTemplates,
    L.venue_templates.map((r) => {
      const createdBy = r.trimmed("createdBy");
      const createdById = ctx.resolveUser(createdBy);
      if (createdBy !== null && createdById === null) {
        ctx.add("orphanReferences", { table: "venue_templates", id: r.id, field: "createdBy", ref: createdBy, action: "NULL" });
      }
      // layoutData olduğu gibi kopyalanır: uygulama eski biçimi okurken dönüştürür (template-layout.ts).
      return {
        id: r.id,
        name: r.text("name"),
        description: r.str("description"),
        layoutData: r.json("layoutData") ?? {},
        isPublic: r.bool("isPublic", false),
        thumbnail: r.str("thumbnail"),
        createdById,
        usageCount: r.int("usageCount") ?? 0,
        ...timestamps(r),
      };
    }),
  );

  const fallbackOrganizer = L.events.some((e) => ctx.resolveUser(e.str("organizerId")) === null) ? defaultOrganizer(ctx) : null;
  const typeOf = tableTypeResolver(ctx);
  const tableRows: (typeof schema.eventTables.$inferInsert)[] = [];
  const droppedKeys = new Map<string, number>();
  const droppedTableProps = new Map<string, number>();
  const droppedDecorProps = new Map<string, number>();
  const bump = (map: Map<string, number>, key: string, n = 1) => map.set(key, (map.get(key) ?? 0) + n);
  let lossyWalls = 0;

  const eventRows = L.events.map((r) => {
    ctx.eventIds.add(r.id);
    let organizerId = ctx.resolveUser(r.str("organizerId"));
    if (organizerId === null) {
      if (fallbackOrganizer === null) throw new Error("Organizatörsüz etkinlik var ama atanabilecek kullanıcı yok");
      ctx.add("eventsWithoutOrganizer", { eventId: r.id, name: r.text("name"), legacyOrganizerId: r.str("organizerId"), assignedOrganizerId: fallbackOrganizer });
      organizerId = fallbackOrganizer;
    }
    const startsAt = r.date("eventDate");
    if (startsAt === null) throw new Error(`Etkinliğin başlangıç tarihi yok: ${r.id}`);
    let endsAt = r.date("eventEndDate");
    if (endsAt !== null && endsAt.getTime() <= startsAt.getTime()) {
      ctx.add("invalidValues", { table: "events", id: r.id, field: "eventEndDate", from: endsAt.toISOString(), to: null, reason: "bitiş başlangıçtan önce/eşit" });
      endsAt = null;
    }
    const status = r.str("status");
    const rawLayout = r.json("venueLayout");
    const layout = parseLayout(rawLayout);
    const index = ctx.tableIndex(r.id);
    for (const t of layout.tables) {
      const id = stableId("event-table", r.id, t.legacyId);
      const tableTypeId = typeOf(t.typeRef);
      if (t.typeRef !== null && tableTypeId === null && t.typeRef.toLowerCase() !== "loca") {
        ctx.add("layoutIssues", { eventId: r.id, kind: "table_type_unmatched", legacyId: t.legacyId, detail: t.typeRef });
      }
      tableRows.push({
        id,
        eventId: r.id,
        label: t.label,
        tableTypeId,
        capacity: t.capacity,
        x: t.x,
        y: t.y,
        rotation: t.rotation,
        isLoca: t.isLoca,
        createdAt: r.date("createdAt") ?? undefined,
        updatedAt: r.date("updatedAt") ?? undefined,
      });
      index.byLegacyId.set(t.legacyId, id);
      index.ids.add(id);
      index.takenLabels.add(normalizeLabel(t.label));
      for (const alias of [t.label, ...t.aliases]) {
        const key = normalizeLabel(alias);
        if (!index.byLabel.has(key)) index.byLabel.set(key, id);
      }
      ctx.add("tableIdMap", { eventId: r.id, legacyTableId: t.legacyId, tableId: id, label: t.label });
    }
    for (const issue of layout.issues) {
      const category = issue.kind === "label_renamed" ? "duplicateLabels" : "layoutIssues";
      ctx.add(category, { eventId: r.id, kind: issue.kind, legacyId: issue.legacyId ?? null, detail: issue.detail });
    }
    if (layout.sourceKeys.length > 0) ctx.add("information", { kind: "layout_source", eventId: r.id, keys: layout.sourceKeys });
    layout.droppedKeys.forEach((k) => bump(droppedKeys, k));
    Object.entries(layout.droppedTableProps).forEach(([k, n]) => bump(droppedTableProps, k, n));
    Object.entries(layout.droppedDecorProps).forEach(([k, n]) => bump(droppedDecorProps, k, n));
    lossyWalls += layout.convertedLines;
    return {
      id: r.id,
      name: r.text("name"),
      description: r.str("description"),
      startsAt,
      endsAt,
      layoutDecor: rawLayout === null ? null : layout.decor,
      status: isEventStatus(status) ? status : "draft",
      eventType: r.str("eventType"),
      coverImage: r.str("coverImage"),
      totalCapacity: r.int("totalCapacity") ?? 0,
      organizerId,
      venueTemplateId: r.str("venueTemplateId"),
      reviewEnabled: r.bool("reviewEnabled", false),
      reviewHistoryVisible: r.bool("reviewHistoryVisible", false),
      reservationEnabled: r.bool("reservationEnabled", true),
      ...timestamps(r),
    };
  });
  await ctx.w.insert(schema.events, eventRows);
  await ctx.w.insert(schema.eventTables, tableRows);

  for (const [key, n] of droppedKeys) ctx.report.gap(`events.venueLayout.${key}`, "nowhere", n, "yerleşim anahtarı yeni şemada yok (etkinlik sayısı)");
  for (const [key, n] of droppedTableProps) {
    ctx.report.gap(`events.venueLayout.(placedTables|tables)[].${key}`, "nowhere", n, "masa özelliği event_tables'ta yok (masa sayısı)");
  }
  for (const [key, n] of droppedDecorProps) ctx.report.gap(`events.venueLayout.stageElements[].${key}`, "nowhere", n, "dekor öğesi özelliği decorSchema'da yok");
  ctx.report.gap("events.venueLayout.(walls|drawnLines)[].points", "events.layout_decor.elements[kind=wall]", lossyWalls, "çoklu nokta çizgisi sınırlayıcı kutuya indirgendi (geometri kaybı)");

  await migrateServicePoints(ctx);
  await migrateShifts(ctx);
}

async function migrateServicePoints(ctx: Ctx): Promise<void> {
  await ctx.w.insert(
    schema.servicePoints,
    ctx.legacy.service_points.map((r) => {
      const required = r.int("requiredStaffCount") ?? 1;
      if (required < 0) ctx.add("invalidValues", { table: "service_points", id: r.id, field: "requiredStaffCount", from: required, to: 0 });
      return {
        id: r.id,
        eventId: r.text("eventId"),
        name: r.text("name"),
        pointType: r.text("pointType", "bar"),
        requiredStaffCount: Math.max(0, required),
        allowedRoles: r.strings("allowedRoles"),
        x: r.num("x") ?? 0,
        y: r.num("y") ?? 0,
        color: r.text("color", "#06b6d4"),
        shape: r.text("shape", "square"),
        description: r.str("description"),
        sortOrder: r.int("sortOrder") ?? 0,
        isActive: r.bool("isActive", true),
        ...timestamps(r),
      };
    }),
  );
}

async function migrateShifts(ctx: Ctx): Promise<void> {
  const taken = new Map<string, Set<string>>();
  const rows = [...ctx.legacy.work_shifts].sort(byCreatedThenId).map((r) => {
    const rawEvent = r.str("eventId");
    const eventId = ctx.resolveEvent(rawEvent);
    if (rawEvent !== null && eventId === null) {
      ctx.add("orphanReferences", { table: "work_shifts", id: r.id, field: "eventId", ref: rawEvent, action: "genel vardiya (NULL)" });
    }
    const scope = eventId ?? "(genel)";
    const set = taken.get(scope) ?? new Set<string>();
    taken.set(scope, set);
    const original = r.text("name");
    const name = uniqueName(original, set, (s) => s);
    if (name !== original) ctx.add("duplicateShiftNames", { shiftId: r.id, eventId, from: original, to: name });
    ctx.shiftIds.add(r.id);
    const start = toTime(r.str("startTime"));
    const end = toTime(r.str("endTime"));
    return {
      id: r.id,
      name,
      startTime: start.value ?? "00:00:00",
      endTime: end.value ?? "00:00:00",
      color: r.text("color", "#3b82f6"),
      sortOrder: r.int("sortOrder") ?? 0,
      isActive: r.bool("isActive", true),
      eventId,
      ...timestamps(r),
    };
  });
  await ctx.w.insert(schema.workShifts, rows);
}
