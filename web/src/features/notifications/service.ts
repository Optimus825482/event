import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { events, notificationReads, notifications } from "@/db/schema";
import { authorize } from "@/features/auth/policy";
import type { Role } from "@/features/auth/roles";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import type { CreateNotificationInput, ListNotificationsInput, MarkReadInput } from "./schemas";

type Executor = Db | Tx;
export type NotificationRow = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
type TargetRole = NotificationRow["targetRole"];

const DEFAULT_PAGE_SIZE = 20;
const NOT_FOUND = "Bildirim bulunamadı";

/** Rolün görebildiği hedef roller (eski davranış: herkese + kendi rolü; organizatör yalnızca "herkes"). */
export function visibleTargetRoles(role: Role): TargetRole[] {
  if (role === "admin" || role === "leader" || role === "staff") return ["all", role];
  return ["all"];
}

/**
 * Yetki denetimi YAPMAYAN iç ekleme: başka servisler (ör. değerlendirmeler) kendi yetkilerini
 * denetledikten sonra bildirim üretmek için kullanır. Oluşturulan satırı döndürür.
 *
 * Gerçek zamanlı yayın bağlantı noktası: çağıran, işlemi (transaction) tamamladıktan SONRA
 * dönen satırı `publishNotifications` (bkz. `publish.ts`) ile yayınlar; transaction içinde yayın yapılmaz.
 */
export async function insertNotification(executor: Executor, input: NewNotification): Promise<NotificationRow> {
  const [row] = await executor.insert(notifications).values(input).returning();
  if (!row) throw new Error("bildirim eklenemedi");
  return row;
}

/** Elle duyuru oluşturma (yönetici/organizatör). */
export async function createNotification(
  executor: Executor,
  actor: Actor,
  input: CreateNotificationInput,
): Promise<NotificationRow> {
  authorize(actor, "notifications", "create");
  if (input.eventId) {
    const [event] = await executor
      .select({ id: events.id, organizerId: events.organizerId })
      .from(events)
      .where(eq(events.id, input.eventId));
    // Organizatör yalnızca kendi etkinliğine bağlayabilir; başkasınınki "yok" gibi davranır.
    if (!event || (actor.role === "organizer" && event.organizerId !== actor.id)) {
      throw new DomainError("not_found", "Etkinlik bulunamadı");
    }
  }
  return insertNotification(executor, {
    type: "system_announcement",
    title: input.title,
    message: input.message,
    priority: input.priority,
    targetRole: input.targetRole,
    eventId: input.eventId ?? null,
    actionUrl: input.actionUrl ?? null,
    createdById: actor.id,
  });
}

function visibleTo(actor: Actor) {
  return and(eq(notifications.isActive, true), inArray(notifications.targetRole, visibleTargetRoles(actor.role)));
}

function readJoin(actor: Actor) {
  return and(eq(notificationReads.notificationId, notifications.id), eq(notificationReads.userId, actor.id));
}

export type NotificationListItem = NotificationRow & { isRead: boolean; eventName: string | null };

export async function listNotifications(executor: Executor, actor: Actor, input: ListNotificationsInput) {
  authorize(actor, "notifications", "view");
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
  const page = input.page ?? 1;
  const unreadOnly = input.unreadOnly ?? false;
  const where = unreadOnly ? and(visibleTo(actor), isNull(notificationReads.id)) : visibleTo(actor);

  const rows = await executor
    .select({
      notification: notifications,
      readId: notificationReads.id,
      eventName: events.name,
    })
    .from(notifications)
    .leftJoin(notificationReads, readJoin(actor))
    .leftJoin(events, eq(events.id, notifications.eventId))
    .where(where)
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [totals] = await executor
    .select({
      total: sql<number>`count(*)::int`,
      unread: sql<number>`count(*) filter (where ${notificationReads.id} is null)::int`,
    })
    .from(notifications)
    .leftJoin(notificationReads, readJoin(actor))
    .where(visibleTo(actor));

  const total = unreadOnly ? (totals?.unread ?? 0) : (totals?.total ?? 0);
  const items: NotificationListItem[] = rows.map((r) => ({
    ...r.notification,
    isRead: r.readId !== null,
    eventName: r.eventName,
  }));
  return { items, total, unreadCount: totals?.unread ?? 0, page, pageSize };
}

/** Okunmamış sayısı (üst çubuk rozeti için). */
export async function countUnread(executor: Executor, actor: Actor): Promise<number> {
  authorize(actor, "notifications", "view");
  const [row] = await executor
    .select({ unread: sql<number>`count(*)::int` })
    .from(notifications)
    .leftJoin(notificationReads, readJoin(actor))
    .where(and(visibleTo(actor), isNull(notificationReads.id)));
  return row?.unread ?? 0;
}

export async function markNotificationRead(executor: Executor, actor: Actor, input: MarkReadInput): Promise<{ id: string }> {
  authorize(actor, "notifications", "view");
  const [visible] = await executor
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.id, input.id), visibleTo(actor)));
  if (!visible) throw new DomainError("not_found", NOT_FOUND);
  await executor
    .insert(notificationReads)
    .values({ notificationId: input.id, userId: actor.id })
    .onConflictDoNothing({ target: [notificationReads.notificationId, notificationReads.userId] });
  return { id: input.id };
}

export async function markAllNotificationsRead(executor: Executor, actor: Actor): Promise<{ marked: number }> {
  authorize(actor, "notifications", "view");
  const unread = await executor
    .select({ id: notifications.id })
    .from(notifications)
    .leftJoin(notificationReads, readJoin(actor))
    .where(and(visibleTo(actor), isNull(notificationReads.id)));
  if (unread.length === 0) return { marked: 0 };
  const inserted = await executor
    .insert(notificationReads)
    .values(unread.map((n) => ({ notificationId: n.id, userId: actor.id })))
    .onConflictDoNothing({ target: [notificationReads.notificationId, notificationReads.userId] })
    .returning({ id: notificationReads.id });
  return { marked: inserted.length };
}
