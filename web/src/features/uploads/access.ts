import { and, eq, exists, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { eventInvitations, events, invitationTemplates } from "@/db/schema";
import { can, type PolicyActor } from "@/features/auth/policy";

export type UploadAccess = "allowed" | "forbidden" | "not_found";

/**
 * Yükleme kategorisi = yolun ilk parçası (`saveImage` çıktısı: `<tür>/<uuid>.webp`); eski yollar da
 * aynı biçimdedir. Davetiye görselleri herkese açık sayfada `/i/<belirteç>/image` üzerinden sunulur,
 * buradan değil.
 *
 * - `logo`: ayarlar ya da davetiye görüntüleyebilen roller (logo davetiye önizlemesinde de görünür).
 * - `invitation`: `invitations:view`; organizatör yalnızca kendi etkinliğinin davetiyesinde ya da
 *   görebildiği şablonda geçen görselleri okur (aksi "yok").
 * - `avatar`, `event` (şu an hiçbir özellik kullanmıyor) ve bilinmeyen kategoriler: yalnızca yönetici.
 */
export async function checkUploadAccess(
  db: Db,
  actor: PolicyActor,
  segments: readonly string[],
): Promise<UploadAccess> {
  if (segments.length !== 2) return "not_found";
  const [category] = segments;
  const relative = segments.join("/");

  if (category === "logo") {
    return can(actor, "settings", "view") || can(actor, "invitations", "view") ? "allowed" : "forbidden";
  }
  if (category === "invitation") {
    if (!can(actor, "invitations", "view")) return "forbidden";
    if (actor.role !== "organizer") return "allowed";
    return (await organizerMayReadInvitationImage(db, actor.id, relative)) ? "allowed" : "not_found";
  }
  return actor.role === "admin" ? "allowed" : "not_found";
}

async function organizerMayReadInvitationImage(db: Db, organizerId: string, relative: string): Promise<boolean> {
  const quoted = JSON.stringify(relative);
  const inInvitation = or(
    eq(eventInvitations.backgroundImage, relative),
    eq(eventInvitations.companyLogo, relative),
    sql`${eventInvitations.eventImages} @> ${JSON.stringify([relative])}::jsonb`,
    sql`strpos(coalesce(${eventInvitations.customElements}::text, ''), ${quoted}) > 0`,
  );
  const inTemplate = or(
    eq(invitationTemplates.backgroundImage, relative),
    sql`strpos(${invitationTemplates.elements}::text, ${quoted}) > 0`,
  );
  const [row] = await db
    .select({
      found: sql<boolean>`(${exists(
        db
          .select({ one: sql`1` })
          .from(eventInvitations)
          .innerJoin(events, eq(events.id, eventInvitations.eventId))
          .where(and(eq(events.organizerId, organizerId), inInvitation)),
      )}) or (${exists(
        db
          .select({ one: sql`1` })
          .from(invitationTemplates)
          .where(
            and(
              inTemplate,
              or(
                eq(invitationTemplates.isSystemTemplate, true),
                eq(invitationTemplates.isDefault, true),
                eq(invitationTemplates.createdById, organizerId),
              ),
            ),
          ),
      )})`,
    })
    .from(sql`(select 1) as one`);
  return row?.found === true;
}
