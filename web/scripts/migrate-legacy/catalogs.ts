import * as schema from "@/db/schema";
import { APP_TIME_ZONE } from "@/lib/time-zone";
import type { Ctx } from "./context";
import { type Row, stableId } from "./values";

/**
 * Kataloglar ve tekil ayar tabloları: departments, positions, work_locations, bağlantıları,
 * staff_roles, table_types, staff_colors, system_settings. Eski kimlikler korunur. Eskide NULL
 * olabilen tamsayı/boolean sütunlar yeni şemada NOT NULL olduğundan eski varsayılana COALESCE edilir.
 */

type CatalogTable = typeof schema.departments | typeof schema.positions | typeof schema.workLocations;

const catalogKey = (name: string) => name.trim().toLocaleLowerCase("tr");

/** Ad → kimlik dizini; personel kaydındaki serbest metin için bul-ya-da-oluştur. */
export class CatalogIndex {
  private readonly byName = new Map<string, string>();
  private readonly created: { id: string; name: string }[] = [];

  constructor(
    readonly kind: "departments" | "positions" | "work_locations",
    rows: Row[],
  ) {
    for (const r of rows) this.byName.set(catalogKey(r.text("name")), r.id);
  }

  /** Boş değer → NULL; bilinmeyen ad → yeni kayıt (deterministik kimlik, raporlanır). */
  idFor(name: string | null, ctx: Ctx, sourceId: string): string | null {
    if (name === null || name.trim() === "") return null;
    const key = catalogKey(name);
    const found = this.byName.get(key);
    if (found) return found;
    const id = stableId("catalog", this.kind, key);
    this.byName.set(key, id);
    this.created.push({ id, name: name.trim() });
    ctx.add("catalogEntriesCreated", { catalog: this.kind, id, name: name.trim(), firstSourceId: sourceId });
    return id;
  }

  async flush(ctx: Ctx, table: CatalogTable): Promise<void> {
    if (this.created.length === 0) return;
    const rows = this.created.splice(0).map((c) => ({ id: c.id, name: c.name }));
    await ctx.w.insert(table, rows);
  }
}

/** Eski `createdAt`/`updatedAt` (ya da snake_case); NULL ise hedef varsayılanı (`now()`). */
export function timestamps(r: Row): { createdAt: Date | undefined; updatedAt: Date | undefined } {
  const createdAt = r.date("createdAt") ?? r.date("created_at") ?? undefined;
  const updatedAt = r.date("updatedAt") ?? r.date("updated_at") ?? createdAt;
  return { createdAt, updatedAt };
}

export async function migrateCatalogs(ctx: Ctx): Promise<{ departments: CatalogIndex; positions: CatalogIndex; workLocations: CatalogIndex }> {
  const L = ctx.legacy;
  await ctx.w.insert(
    schema.departments,
    L.departments.map((r) => ({
      id: r.id,
      name: r.text("name").trim(),
      description: r.str("description"),
      color: r.str("color"),
      sortOrder: r.int("sortOrder") ?? 0,
      isActive: r.bool("isActive", true),
      ...timestamps(r),
    })),
  );
  await ctx.w.insert(
    schema.positions,
    L.positions.map((r) => ({
      id: r.id,
      name: r.text("name").trim(),
      description: r.str("description"),
      sortOrder: r.int("sortOrder") ?? 0,
      isActive: r.bool("isActive", true),
      ...timestamps(r),
    })),
  );
  await ctx.w.insert(
    schema.workLocations,
    L.work_locations.map((r) => ({
      id: r.id,
      name: r.text("name").trim(),
      description: r.str("description"),
      address: r.str("address"),
      sortOrder: r.int("sortOrder") ?? 0,
      isActive: r.bool("isActive", true),
      ...timestamps(r),
    })),
  );
  await ctx.w.insert(
    schema.departmentPositions,
    L.department_positions.map((r) => ({
      id: r.id,
      departmentId: r.text("departmentId"),
      positionId: r.text("positionId"),
      createdAt: r.date("createdAt") ?? undefined,
    })),
  );
  await ctx.w.insert(
    schema.departmentLocations,
    L.department_locations.map((r) => ({
      id: r.id,
      departmentId: r.text("departmentId"),
      workLocationId: r.text("workLocationId"),
      createdAt: r.date("createdAt") ?? undefined,
    })),
  );
  await ctx.w.insert(
    schema.staffRoles,
    L.staff_roles.map((r) => ({
      id: r.id,
      key: r.text("key"),
      label: r.text("label"),
      color: r.text("color", "#3b82f6"),
      badgeColor: r.text("badgeColor", "bg-blue-500/20 text-blue-400 border-blue-500/30"),
      bgColor: r.text("bgColor", "bg-blue-500"),
      sortOrder: r.int("sortOrder") ?? 0,
      isActive: r.bool("isActive", true),
      ...timestamps(r),
    })),
  );
  await ctx.w.insert(
    schema.tableTypes,
    L.table_types.map((r) => {
      const capacity = r.int("capacity") ?? 8;
      const price = r.num("basePrice") ?? 0;
      if (capacity < 1) ctx.add("invalidValues", { table: "table_types", id: r.id, field: "capacity", from: capacity, to: 8 });
      if (price < 0) ctx.add("invalidValues", { table: "table_types", id: r.id, field: "basePrice", from: price, to: 0 });
      ctx.tableTypeIds.add(r.id);
      return {
        id: r.id,
        name: r.text("name"),
        color: r.text("color", "#3b82f6"),
        icon: r.str("icon"),
        basePrice: price < 0 ? "0" : r.text("basePrice", "0"),
        shape: r.text("shape", "round"),
        capacity: capacity < 1 ? 8 : capacity,
        minSpacing: r.int("minSpacing") ?? 50,
        isActive: r.bool("isActive", true),
        ...timestamps(r),
      };
    }),
  );
  await ctx.w.insert(
    schema.staffColors,
    L.staff_colors.map((r) => ({
      id: r.id,
      name: r.text("name"),
      color: r.text("color"),
      isActive: r.bool("isActive", true),
      ...timestamps(r),
    })),
  );
  await migrateSettings(ctx);
  return {
    departments: new CatalogIndex("departments", L.departments),
    positions: new CatalogIndex("positions", L.positions),
    workLocations: new CatalogIndex("work_locations", L.work_locations),
  };
}

async function migrateSettings(ctx: Ctx): Promise<void> {
  const rows = ctx.legacy.system_settings;
  if (rows.length > 1) ctx.add("information", { table: "system_settings", detail: `${rows.length} ayar satırı var; hepsi taşındı` });
  await ctx.w.insert(
    schema.systemSettings,
    rows.map((r) => {
      if (r.trimmed("smtpPassword") !== null) {
        ctx.add("skippedRows", { table: "system_settings", id: r.id, field: "smtpPassword", detail: "SMTP parolası taşınmadı; ayarlardan yeniden girilmeli" });
      }
      const legacyZone = r.trimmed("timezone");
      if (legacyZone !== null && legacyZone !== APP_TIME_ZONE) {
        ctx.add("skippedRows", { table: "system_settings", id: r.id, field: "timezone", detail: `Saat dilimi (${legacyZone}) taşınmadı; uygulama yalnızca Kıbrıs saatini (Asia/Famagusta) kullanır` });
      }
      return {
        id: r.id,
        companyName: r.text("companyName", "EventFlow"),
        logo: r.str("logo"),
        language: r.text("language", "tr"),
        defaultGridSize: r.int("defaultGridSize") ?? 20,
        snapToGrid: r.bool("snapToGrid", true),
        showGridByDefault: r.bool("showGridByDefault", true),
        defaultGuestCount: r.int("defaultGuestCount") ?? 2,
        allowOverbooking: r.bool("allowOverbooking", false),
        requirePhoneNumber: r.bool("requirePhoneNumber", true),
        requireEmail: r.bool("requireEmail", false),
        autoCheckInEnabled: r.bool("autoCheckInEnabled", false),
        checkInSoundEnabled: r.bool("checkInSoundEnabled", true),
        showTableDirections: r.bool("showTableDirections", true),
        emailNotifications: r.bool("emailNotifications", true),
        smsNotifications: r.bool("smsNotifications", false),
        qrCodeSystemEnabled: r.bool("qrCodeSystemEnabled", true),
        invitationSystemEnabled: r.bool("invitationSystemEnabled", true),
        smtpHost: r.str("smtpHost"),
        smtpPort: r.int("smtpPort") ?? 587,
        smtpUser: r.str("smtpUser"),
        smtpPasswordEncrypted: null,
        smtpFromEmail: r.str("smtpFromEmail"),
        smtpFromName: r.str("smtpFromName"),
        smtpSecure: r.bool("smtpSecure", false),
        ...timestamps(r),
      };
    }),
  );
}
