import { desc, eq, or, type SQL } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { users, venueTemplates } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import type { TemplateIdInput, UpdateTemplateInput } from "./schemas";
import { parseTemplateLayout } from "./template-layout";

type Executor = Db | Tx;
export type VenueTemplateRow = typeof venueTemplates.$inferSelect;

const NOT_FOUND = "Mekân şablonu bulunamadı";

export async function getTemplateOrThrow(db: Executor, id: string): Promise<VenueTemplateRow> {
  const [row] = await db.select().from(venueTemplates).where(eq(venueTemplates.id, id));
  if (!row) throw new DomainError("not_found", NOT_FOUND);
  return row;
}

/**
 * Eylem kapısı için şablonun sahibi. Olmayan şablon varlığını sızdırmasın diye hata atmaz:
 * sahipsiz kaynak mekân sahibi için `forbidden` olur (başkasının şablonuyla aynı), yönetici ise
 * servisten `not_found` alır.
 */
export async function templateOwnerResource(db: Executor, id: string): Promise<{ ownerId?: string }> {
  const [row] = await db
    .select({ createdById: venueTemplates.createdById })
    .from(venueTemplates)
    .where(eq(venueTemplates.id, id));
  return row?.createdById ? { ownerId: row.createdById } : {};
}

/** Yönetici hepsini, diğerleri kendi şablonlarını ve herkese açık olanları görür. */
export function canSeeTemplate(actor: Actor, template: Pick<VenueTemplateRow, "isPublic" | "createdById">): boolean {
  return actor.role === "admin" || template.isPublic || template.createdById === actor.id;
}

/** Yalnızca yönetici ve şablonun sahibi değiştirebilir/silebilir. */
export function canManageTemplate(actor: Actor, template: Pick<VenueTemplateRow, "createdById">): boolean {
  return actor.role === "admin" || template.createdById === actor.id;
}

export function assertTemplateVisible(actor: Actor, template: VenueTemplateRow): void {
  if (!canSeeTemplate(actor, template)) throw new DomainError("not_found", NOT_FOUND);
}

async function getManageableTemplate(db: Executor, actor: Actor, id: string): Promise<VenueTemplateRow> {
  const template = await getTemplateOrThrow(db, id);
  assertTemplateVisible(actor, template);
  if (!canManageTemplate(actor, template)) {
    throw new DomainError("conflict", "Yalnızca kendi şablonlarınızı değiştirebilirsiniz");
  }
  return template;
}

export type VenueTemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  usageCount: number;
  tableCount: number;
  capacity: number;
  createdByName: string | null;
  canManage: boolean;
  updatedAt: Date;
};

export async function listVenueTemplates(db: Executor, actor: Actor): Promise<VenueTemplateSummary[]> {
  const where: SQL | undefined =
    actor.role === "admin" ? undefined : or(eq(venueTemplates.isPublic, true), eq(venueTemplates.createdById, actor.id));
  const rows = await db
    .select({ template: venueTemplates, createdByName: users.name })
    .from(venueTemplates)
    .leftJoin(users, eq(users.id, venueTemplates.createdById))
    .where(where)
    .orderBy(desc(venueTemplates.updatedAt), venueTemplates.id);
  return rows.map(({ template, createdByName }) => {
    const layout = parseTemplateLayout(template.layoutData);
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      isPublic: template.isPublic,
      usageCount: template.usageCount,
      tableCount: layout.tables.length,
      capacity: layout.tables.reduce((sum, t) => sum + t.capacity, 0),
      createdByName,
      canManage: canManageTemplate(actor, template),
      updatedAt: template.updatedAt,
    };
  });
}

export async function updateVenueTemplate(db: Executor, actor: Actor, input: UpdateTemplateInput) {
  await getManageableTemplate(db, actor, input.id);
  const [row] = await db
    .update(venueTemplates)
    .set({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      isPublic: input.isPublic ?? false,
      updatedAt: new Date(),
    })
    .where(eq(venueTemplates.id, input.id))
    .returning();
  if (!row) throw new DomainError("not_found", NOT_FOUND);
  return row;
}

/** Şablonu siler; onu kullanan etkinliklerin `venue_template_id` alanı boşalır (masaları etkilenmez). */
export async function deleteVenueTemplate(db: Executor, actor: Actor, input: TemplateIdInput) {
  await getManageableTemplate(db, actor, input.id);
  await db.delete(venueTemplates).where(eq(venueTemplates.id, input.id));
  return { id: input.id };
}

/** Görülebilen bir şablonu işlemi yapanın özel kopyası olarak çoğaltır. */
export async function duplicateVenueTemplate(db: Executor, actor: Actor, input: TemplateIdInput) {
  const source = await getTemplateOrThrow(db, input.id);
  assertTemplateVisible(actor, source);
  const [row] = await db
    .insert(venueTemplates)
    .values({
      name: `${source.name} (Kopya)`.slice(0, 120),
      description: source.description,
      layoutData: parseTemplateLayout(source.layoutData),
      isPublic: false,
      createdById: actor.id,
    })
    .returning();
  if (!row) throw new Error("şablon kopyalanamadı");
  return row;
}
