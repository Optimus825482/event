import { eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { customers, eventTables, events, reservations, systemSettings } from "@/db/schema";
import { withFieldValues, type FieldValues, type InvitationElement } from "./elements";
import { layoutImagePaths, resolveEventLayout, type ResolvedLayout } from "./layout";
import { parseInvitationToken, verifyInvitationMac } from "./token";
import { APP_TIME_ZONE } from "@/lib/time-zone";

type Executor = Db | Tx;

/** Herkese açık davetiyenin gösterdiği alanların TAMAMI. Telefon, e-posta, not ve iç kimlik yoktur. */
export type PublicInvitation = {
  guestName: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  tableLabel: string;
  /** Giriş QR'ının içeriği; yalnızca sunucuda görüntüye çevrilir. */
  qrPayload: string;
  width: number;
  height: number;
  backgroundColor: string | null;
  backgroundGradient: string | null;
  backgroundImage: string | null;
  /** `content` yer tutucuları doldurulmuş, `logo` öğelerine logo yolu verilmiş öğeler. */
  elements: InvitationElement[];
};

type Target = {
  guestName: string | null;
  customerName: string;
  qrToken: string;
  status: string;
  eventId: string;
  eventName: string;
  eventDescription: string | null;
  startsAt: Date;
  tableLabel: string;
};

async function loadTarget(db: Executor, token: string): Promise<Target | null> {
  const parsed = parseInvitationToken(token);
  if (!parsed) return null;
  const [row] = await db
    .select({
      guestName: reservations.guestName,
      customerName: customers.fullName,
      qrToken: reservations.qrToken,
      status: reservations.status,
      eventId: reservations.eventId,
      eventName: events.name,
      eventDescription: events.description,
      startsAt: events.startsAt,
      tableLabel: eventTables.label,
    })
    .from(reservations)
    .innerJoin(events, eq(events.id, reservations.eventId))
    .innerJoin(customers, eq(customers.id, reservations.customerId))
    .innerJoin(eventTables, eq(eventTables.id, reservations.tableId))
    .where(eq(reservations.id, parsed.reservationId));
  if (!row) return null;
  // İmza, rezervasyonun gerçek etkinliğine bağlıdır: başka etkinlik için üretilmiş belirteç eşleşmez.
  if (!verifyInvitationMac(parsed, row.eventId)) return null;
  if (row.status === "cancelled" || row.status === "no_show") return null;
  return row;
}

async function readSystemFlags(db: Executor): Promise<{ enabled: boolean }> {
  const [row] = await db.select({ enabled: systemSettings.invitationSystemEnabled }).from(systemSettings).limit(1);
  return { enabled: row?.enabled ?? true };
}

/** Davetiyedeki etkinlik tarihi ve saati; her zaman uygulama saat diliminde (Kıbrıs). */
export function formatEventWhen(date: Date): { date: string; time: string } {
  return {
    date: new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: APP_TIME_ZONE }).format(date),
    time: new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: APP_TIME_ZONE }).format(date),
  };
}

type Fields = FieldValues;

function renderElements(layout: ResolvedLayout, fields: Fields): InvitationElement[] {
  return layout.elements.map((element) => {
    const out = withFieldValues(element, fields);
    if (element.type === "logo") {
      return layout.companyLogo ? { ...out, imageUrl: layout.companyLogo } : { ...out, imageUrl: undefined };
    }
    if (element.type === "qrcode") return { ...out, content: undefined };
    return out;
  });
}

/**
 * Herkese açık davetiye. Geçersiz/başka etkinliğe ait belirteç, iptal edilmiş rezervasyon
 * ve kapalı davetiye sistemi için `null`. Yalnızca davetiyenin gösterdiği alanları döner.
 */
export async function getPublicInvitation(db: Executor, token: string): Promise<PublicInvitation | null> {
  const target = await loadTarget(db, token);
  if (!target) return null;
  const flags = await readSystemFlags(db);
  if (!flags.enabled) return null;

  const layout = await resolveEventLayout(db, target.eventId);
  const when = formatEventWhen(target.startsAt);
  const guestName = target.guestName?.trim() || target.customerName || "Misafir";
  const fields: Fields = {
    guestName,
    eventName: target.eventName,
    eventDate: when.date,
    eventTime: when.time,
    eventLocation: "",
    eventDescription: target.eventDescription ?? "",
    tableLabel: target.tableLabel,
  };

  return {
    guestName,
    eventName: target.eventName,
    eventDate: when.date,
    eventTime: when.time,
    tableLabel: target.tableLabel,
    qrPayload: target.qrToken,
    width: layout.width,
    height: layout.height,
    backgroundColor: layout.backgroundColor,
    backgroundGradient: layout.backgroundGradient,
    backgroundImage: layout.backgroundImage,
    elements: renderElements(layout, fields),
  };
}

/** Görsel rotası için: belirteç geçerliyse ve `path` o etkinliğin davetiyesinde gösteriliyorsa `path`, yoksa `null`. */
export async function getPublicInvitationImagePath(db: Executor, token: string, path: string): Promise<string | null> {
  const target = await loadTarget(db, token);
  if (!target) return null;
  const flags = await readSystemFlags(db);
  if (!flags.enabled) return null;
  const layout = await resolveEventLayout(db, target.eventId);
  return layoutImagePaths(layout).includes(path) ? path : null;
}
