import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { authorize, can } from "@/features/auth/policy";
import { requirePolicyActor } from "@/features/auth/permissions";
import { DomainError } from "@/lib/action";
import { isUuid } from "@/lib/identifiers";
import type { WizardTemplate } from "./board";
import { listEventsFilterSchema } from "./schemas";
import { listOrganizationTemplates } from "@/features/staffing/templates-service";
import { listVenueTemplates } from "@/features/venue/templates-service";
import { getEvent, listEventBoard, listEventTables, listEvents } from "./service";

export async function loadEventList(rawFilter: unknown) {
  const actor = await requirePolicyActor();
  authorize(actor, "events", "view");
  const parsed = listEventsFilterSchema.safeParse(rawFilter);
  return listEvents(db, actor, parsed.success ? parsed.data : {});
}

/** Etkinlik ayrıntısı + masalar. Kimlik geçersizse ya da kayıt görünmüyorsa 404. */
export async function loadEventDetail(id: string) {
  const actor = await requirePolicyActor();
  authorize(actor, "events", "view");
  if (!isUuid(id)) notFound();
  try {
    const event = await getEvent(db, actor, id);
    const tables = await listEventTables(db, id);
    return { event, tables };
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
}

/** Etkinlik panosu verisi (arama süzgeci uygulanmış tüm liste). Sekmelere bölme sayfada yapılır. */
export async function loadEventBoard(search: string | undefined) {
  const actor = await requirePolicyActor();
  authorize(actor, "events", "view");
  const parsed = listEventsFilterSchema.shape.search.safeParse(search);
  const items = await listEventBoard(db, actor, { search: parsed.success ? parsed.data : undefined });
  return {
    items,
    canCreate: can(actor, "events", "create"),
    canEdit: can(actor, "events", "edit"),
    canDelete: can(actor, "events", "delete"),
  };
}

/** Yeni etkinlik sihirbazı seçenekleri: yalnızca kullanıcının görebildiği şablonlar. */
export async function loadWizardOptions() {
  const actor = await requirePolicyActor();
  if (!can(actor, "events", "create")) notFound();
  const canVenue = can(actor, "venues", "view");
  const canTeam = can(actor, "events", "view");
  const [venue, team] = await Promise.all([
    canVenue ? listVenueTemplates(db, actor) : Promise.resolve([]),
    canTeam ? listOrganizationTemplates(db, actor) : Promise.resolve([]),
  ]);
  const venueTemplates: WizardTemplate[] = venue.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    detail: `${t.tableCount} masa · ${t.capacity} kişi`,
  }));
  const teamTemplates: WizardTemplate[] = team.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    detail: t.isDefault ? "Varsayılan şablon" : "Kişisel şablon",
  }));
  return {
    venueTemplates,
    teamTemplates,
    canApplyVenue: can(actor, "events", "edit") && canVenue,
    canApplyTeam: can(actor, "events", "edit") && canTeam,
    canInvite: can(actor, "events", "view"),
  };
}
