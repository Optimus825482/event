import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { invitationTemplates } from "@/db/schema";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { assertInvitationSystemEnabled } from "./access";
import { DEFAULT_TEMPLATE_ELEMENTS, DEFAULT_TEMPLATE_NAME, INVITATION_SIZES, smartFixElements } from "./elements";
import type { CreateTemplateInput, TemplateIdInput, UpdateTemplateInput } from "./schemas";
import { isAdmin } from "@/features/auth/scope";

type Executor = Db | Tx;
export type TemplateRow = typeof invitationTemplates.$inferSelect;

const NOT_FOUND = "Şablon bulunamadı";

/** Yönetici hepsini; diğerleri kendi şablonlarını, sistem ve varsayılan şablonları görür. */
export function canSeeTemplate(
  actor: Actor,
  template: Pick<TemplateRow, "createdById" | "isSystemTemplate" | "isDefault">,
): boolean {
  return isAdmin(actor) || template.isSystemTemplate || template.isDefault || template.createdById === actor.id;
}

/** Yalnızca yönetici ve sahibi değiştirebilir/silebilir; sistem şablonları yalnızca yöneticiye aittir. */
export function canManageTemplate(actor: Actor, template: Pick<TemplateRow, "createdById" | "isSystemTemplate">): boolean {
  if (isAdmin(actor)) return true;
  return !template.isSystemTemplate && template.createdById === actor.id;
}

function assertVisible(actor: Actor, template: TemplateRow): void {
  if (!canSeeTemplate(actor, template)) throw new DomainError("not_found", NOT_FOUND);
}

function assertManageable(actor: Actor, template: TemplateRow): void {
  assertVisible(actor, template);
  if (!canManageTemplate(actor, template)) {
    throw new DomainError("conflict", "Yalnızca kendi şablonlarınızı değiştirebilirsiniz");
  }
}

async function findActive(db: Executor, id: string): Promise<TemplateRow> {
  const [row] = await db
    .select()
    .from(invitationTemplates)
    .where(and(eq(invitationTemplates.id, id), eq(invitationTemplates.isActive, true)));
  if (!row) throw new DomainError("not_found", NOT_FOUND);
  return row;
}

/** Sistem şablonu "Standart Davetiye" yoksa oluşturur (eşzamanlı çağrılarda tek satır). */
export async function ensureDefaultTemplate(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('invitation_default_template'))`);
    const [existing] = await tx
      .select({ id: invitationTemplates.id })
      .from(invitationTemplates)
      .where(and(eq(invitationTemplates.isSystemTemplate, true), eq(invitationTemplates.name, DEFAULT_TEMPLATE_NAME)));
    if (existing) return;
    const [anyDefault] = await tx
      .select({ id: invitationTemplates.id })
      .from(invitationTemplates)
      .where(and(eq(invitationTemplates.isDefault, true), eq(invitationTemplates.isActive, true)));
    await tx.insert(invitationTemplates).values({
      name: DEFAULT_TEMPLATE_NAME,
      description: "Varsayılan A5 boyutunda davetiye şablonu",
      isDefault: !anyDefault,
      isSystemTemplate: true,
      size: "A5",
      width: INVITATION_SIZES.A5.width,
      height: INVITATION_SIZES.A5.height,
      backgroundColor: "#FFFFFF",
      elements: DEFAULT_TEMPLATE_ELEMENTS,
    });
  });
}

export async function listTemplates(db: Db, actor: Actor): Promise<TemplateRow[]> {
  authorize(actor, "invitations", "view");
  await ensureDefaultTemplate(db);
  return db
    .select()
    .from(invitationTemplates)
    .where(
      and(
        eq(invitationTemplates.isActive, true),
        isAdmin(actor)
          ? undefined
          : or(
              eq(invitationTemplates.isSystemTemplate, true),
              eq(invitationTemplates.isDefault, true),
              eq(invitationTemplates.createdById, actor.id),
            ),
      ),
    )
    .orderBy(desc(invitationTemplates.isDefault), desc(invitationTemplates.createdAt), asc(invitationTemplates.id));
}

export async function getTemplate(db: Executor, actor: Actor, id: string): Promise<TemplateRow> {
  authorize(actor, "invitations", "view");
  const row = await findActive(db, id);
  assertVisible(actor, row);
  return row;
}

export async function createTemplate(db: Executor, actor: Actor, input: CreateTemplateInput): Promise<TemplateRow> {
  authorize(actor, "invitations", "create");
  await assertInvitationSystemEnabled(db);
  const [row] = await db
    .insert(invitationTemplates)
    .values({
      name: input.name,
      description: input.description || null,
      size: input.size,
      width: input.width,
      height: input.height,
      backgroundColor: input.backgroundColor,
      backgroundImage: input.backgroundImage,
      backgroundGradient: input.backgroundGradient,
      elements: smartFixElements(input.elements, input.width, input.height),
      createdById: actor.id,
      isDefault: false,
      isSystemTemplate: false,
    })
    .returning();
  if (!row) throw new Error("şablon eklenemedi");
  return row;
}

/** Sistem şablonunun varsayılan/sistem bayrakları değiştirilemez (bu işlev zaten bunlara dokunmaz). */
export async function updateTemplate(db: Executor, actor: Actor, input: UpdateTemplateInput): Promise<TemplateRow> {
  authorize(actor, "invitations", "edit");
  await assertInvitationSystemEnabled(db);
  assertManageable(actor, await findActive(db, input.id));
  const [row] = await db
    .update(invitationTemplates)
    .set({
      name: input.name,
      description: input.description || null,
      size: input.size,
      width: input.width,
      height: input.height,
      backgroundColor: input.backgroundColor,
      backgroundImage: input.backgroundImage,
      backgroundGradient: input.backgroundGradient,
      elements: smartFixElements(input.elements, input.width, input.height),
      updatedAt: new Date(),
    })
    .where(eq(invitationTemplates.id, input.id))
    .returning();
  if (!row) throw new DomainError("not_found", NOT_FOUND);
  return row;
}

/** Yumuşak silme. Sistem şablonu silinemez; varsayılan şablon silinirse sistem şablonu varsayılan olur. */
export async function deleteTemplate(db: Db, actor: Actor, input: TemplateIdInput): Promise<{ id: string }> {
  authorize(actor, "invitations", "delete");
  await assertInvitationSystemEnabled(db);
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(invitationTemplates)
      .where(and(eq(invitationTemplates.id, input.id), eq(invitationTemplates.isActive, true)))
      .for("update");
    if (!locked) throw new DomainError("not_found", NOT_FOUND);
    assertManageable(actor, locked);
    if (locked.isSystemTemplate) throw new DomainError("conflict", "Sistem şablonları silinemez");
    await tx
      .update(invitationTemplates)
      .set({ isActive: false, isDefault: false, updatedAt: new Date() })
      .where(eq(invitationTemplates.id, input.id));
    if (locked.isDefault) {
      await tx
        .update(invitationTemplates)
        .set({ isDefault: true })
        .where(and(eq(invitationTemplates.isSystemTemplate, true), eq(invitationTemplates.isActive, true)));
    }
    return { id: input.id };
  });
}

export async function setDefaultTemplate(db: Db, actor: Actor, input: TemplateIdInput): Promise<{ id: string }> {
  authorize(actor, "invitations", "edit");
  if (!isAdmin(actor)) throw new DomainError("conflict", "Varsayılan şablonu yalnızca yönetici değiştirebilir");
  await assertInvitationSystemEnabled(db);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('invitation_default_template'))`);
    await findActive(tx, input.id);
    await tx.update(invitationTemplates).set({ isDefault: false }).where(eq(invitationTemplates.isDefault, true));
    await tx.update(invitationTemplates).set({ isDefault: true }).where(eq(invitationTemplates.id, input.id));
    return { id: input.id };
  });
}
