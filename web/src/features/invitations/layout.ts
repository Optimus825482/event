import { and, desc, eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventInvitations, invitationTemplates, systemSettings } from "@/db/schema";
import {
  DEFAULT_TEMPLATE_ELEMENTS,
  INVITATION_SIZES,
  UPLOAD_PATH,
  parseStoredElements,
  type InvitationElement,
} from "./elements";

type Executor = Db | Tx;

export type ResolvedLayout = {
  source: "custom" | "template" | "default";
  templateId: string | null;
  width: number;
  height: number;
  backgroundColor: string | null;
  backgroundGradient: string | null;
  backgroundImage: string | null;
  elements: InvitationElement[];
  companyLogo: string | null;
  /** Etkinliğe yüklenmiş görüntüler (yalnızca geçerli yükleme yolları). */
  eventImages: string[];
  invitationId: string | null;
};

function uploadPathOrNull(value: string | null | undefined): string | null {
  return value && UPLOAD_PATH.test(value) ? value : null;
}

function uploadPaths(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string" && UPLOAD_PATH.test(v));
}

/** Etkinliğin davetiye düzenini çözer: özel tasarım → seçili şablon → varsayılan şablon → yerleşik. */
export async function resolveEventLayout(db: Executor, eventId: string): Promise<ResolvedLayout> {
  const [invitation] = await db
    .select()
    .from(eventInvitations)
    .where(and(eq(eventInvitations.eventId, eventId), eq(eventInvitations.isActive, true)))
    .orderBy(desc(eventInvitations.updatedAt))
    .limit(1);
  const [settings] = await db.select({ logo: systemSettings.logo }).from(systemSettings).limit(1);

  const companyLogo = uploadPathOrNull(invitation?.companyLogo) ?? uploadPathOrNull(settings?.logo);
  const eventImages = uploadPaths(invitation?.eventImages);
  const invitationId = invitation?.id ?? null;

  if (invitation?.customElements) {
    return {
      source: "custom",
      templateId: invitation.templateId,
      width: invitation.width,
      height: invitation.height,
      backgroundColor: invitation.backgroundColor,
      backgroundGradient: invitation.backgroundGradient,
      backgroundImage: uploadPathOrNull(invitation.backgroundImage),
      elements: parseStoredElements(invitation.customElements),
      companyLogo,
      eventImages,
      invitationId,
    };
  }

  const [chosen] = invitation?.templateId
    ? await db
        .select()
        .from(invitationTemplates)
        .where(and(eq(invitationTemplates.id, invitation.templateId), eq(invitationTemplates.isActive, true)))
    : [];
  const [fallback] = chosen
    ? []
    : await db
        .select()
        .from(invitationTemplates)
        .where(and(eq(invitationTemplates.isDefault, true), eq(invitationTemplates.isActive, true)))
        .limit(1);
  const template = chosen ?? fallback;

  if (template) {
    return {
      source: chosen ? "template" : "default",
      templateId: chosen ? template.id : (invitation?.templateId ?? null),
      width: template.width,
      height: template.height,
      backgroundColor: template.backgroundColor,
      backgroundGradient: template.backgroundGradient,
      backgroundImage: uploadPathOrNull(template.backgroundImage),
      elements: parseStoredElements(template.elements),
      companyLogo,
      eventImages,
      invitationId,
    };
  }

  return {
    source: "default",
    templateId: null,
    width: INVITATION_SIZES.A5.width,
    height: INVITATION_SIZES.A5.height,
    backgroundColor: "#FFFFFF",
    backgroundGradient: null,
    backgroundImage: null,
    elements: DEFAULT_TEMPLATE_ELEMENTS,
    companyLogo,
    eventImages,
    invitationId,
  };
}

/** Düzenin gösterdiği tüm yükleme yolları (herkese açık görsel rotası yalnızca bunları sunar). */
export function layoutImagePaths(layout: ResolvedLayout): string[] {
  const paths = new Set<string>();
  if (layout.backgroundImage) paths.add(layout.backgroundImage);
  if (layout.companyLogo) paths.add(layout.companyLogo);
  for (const path of layout.eventImages) paths.add(path);
  for (const element of layout.elements) {
    const own = uploadPathOrNull(element.imageUrl);
    if (own) paths.add(own);
  }
  return [...paths];
}
