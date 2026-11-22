import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { can, authorize } from "@/features/auth/policy";
import { requirePolicyActor } from "@/features/auth/permissions";
import { DomainError } from "@/lib/action";
import { isUuid } from "@/lib/identifiers";
import { getVenueLayout } from "./service";
import { listTableTypes } from "./table-types-service";
import { listVenueTemplates } from "./templates-service";

/** Yerleşim düzenleyicisi için her şey. Kimlik geçersizse ya da etkinlik görünmüyorsa 404. */
export async function loadVenueEditor(eventId: string) {
  const actor = await requirePolicyActor();
  authorize(actor, "events", "view");
  if (!isUuid(eventId)) notFound();
  try {
    const layout = await getVenueLayout(db, actor, eventId);
    const tableTypes = await listTableTypes(db);
    const templates = can(actor, "venues", "view") ? await listVenueTemplates(db, actor) : [];
    return {
      layout,
      // Pasif tipler yalnızca zaten kullanılıyorsa listelenir (mevcut masaların rengi kaybolmasın).
      tableTypes: tableTypes
        .filter((t) => t.isActive || layout.tables.some((table) => table.tableTypeId === t.id))
        .map((t) => ({ id: t.id, name: t.name, color: t.color, shape: t.shape, capacity: t.capacity, isActive: t.isActive })),
      templates: templates.map((t) => ({ id: t.id, name: t.name, tableCount: t.tableCount, isPublic: t.isPublic })),
      canEdit: can(actor, "events", "edit") && layout.editable,
      canSaveTemplate: can(actor, "venues", "create"),
    };
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
}

export async function loadVenueTemplates() {
  const actor = await requirePolicyActor();
  authorize(actor, "venues", "view");
  const templates = await listVenueTemplates(db, actor);
  return {
    templates,
    canEdit: can(actor, "venues", "edit"),
    canDelete: can(actor, "venues", "delete"),
    canCreate: can(actor, "venues", "create"),
  };
}

export async function loadTableTypes() {
  const actor = await requirePolicyActor();
  authorize(actor, "settings", "view");
  return {
    tableTypes: await listTableTypes(db),
    canCreate: can(actor, "settings", "create"),
    canEdit: can(actor, "settings", "edit"),
    canDelete: can(actor, "settings", "delete"),
  };
}
