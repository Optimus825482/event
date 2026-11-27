import { and, eq, inArray, or } from "drizzle-orm";
import type { Tx } from "@/db/client";
import {
  artists,
  checkInEvents,
  eventArchives,
  eventSiteContent,
  events,
  notifications,
  orders,
  paymentAttempts,
  reservations,
  tickets,
} from "@/db/schema";
import { IMAGE_PATH_PATTERN } from "@/features/sales-api/contract";

function pushValidImage(list: string[], imagePath: string | null | undefined): void {
  if (imagePath && IMAGE_PATH_PATTERN.test(imagePath)) {
    list.push(imagePath);
  }
}

/**
 * Tüm demo etkinliklerini (`is_demo = true`), bağlı sipariş/bilet/arşiv/bildirim kayıtlarını ve
 * gerçek bir etkinliğe ya da arşive bağlı olmayan demo sanatçıları kalıcı olarak siler.
 * Dosyaları silmez; işlem onaylandıktan sonra silinecek geçerli görsel yollarını döner.
 */
export async function purgeDemoData(tx: Tx): Promise<{
  events: number;
  orders: number;
  imagePaths: string[];
}> {
  const imagePaths: string[] = [];

  const demoEvents = await tx
    .select({ id: events.id, coverImage: events.coverImage })
    .from(events)
    .where(eq(events.isDemo, true))
    .for("update");

  const eventIds = demoEvents.map((e) => e.id);
  let deletedOrdersCount = 0;

  if (eventIds.length > 0) {
    for (const ev of demoEvents) {
      pushValidImage(imagePaths, ev.coverImage);
    }

    const siteRows = await tx
      .select({ heroImage: eventSiteContent.heroImage })
      .from(eventSiteContent)
      .where(inArray(eventSiteContent.eventId, eventIds));
    for (const site of siteRows) {
      pushValidImage(imagePaths, site.heroImage);
    }

    const ticketIdsSq = tx
      .select({ id: tickets.id })
      .from(tickets)
      .where(inArray(tickets.eventId, eventIds));
    const reservationIdsSq = tx
      .select({ id: reservations.id })
      .from(reservations)
      .where(inArray(reservations.eventId, eventIds));

    await tx
      .delete(checkInEvents)
      .where(
        or(
          inArray(checkInEvents.ticketId, ticketIdsSq),
          inArray(checkInEvents.reservationId, reservationIdsSq),
        ),
      );

    const orderIdsSq = tx
      .select({ id: orders.id })
      .from(orders)
      .where(inArray(orders.eventId, eventIds));

    await tx.delete(paymentAttempts).where(inArray(paymentAttempts.orderId, orderIdsSq));
    await tx.delete(tickets).where(inArray(tickets.eventId, eventIds));
    const deletedOrders = await tx
      .delete(orders)
      .where(inArray(orders.eventId, eventIds))
      .returning({ id: orders.id });
    deletedOrdersCount = deletedOrders.length;

    await tx.delete(reservations).where(inArray(reservations.eventId, eventIds));
    await tx.delete(eventArchives).where(inArray(eventArchives.eventId, eventIds));
    await tx.delete(notifications).where(inArray(notifications.eventId, eventIds));
    await tx.delete(events).where(and(inArray(events.id, eventIds), eq(events.isDemo, true)));
  }

  const demoArtists = await tx
    .select({ id: artists.id, image: artists.image })
    .from(artists)
    .where(eq(artists.isDemo, true))
    .for("update");

  for (const artist of demoArtists) {
    const [usedInEvent] = await tx
      .select({ id: events.id })
      .from(events)
      .where(eq(events.artistId, artist.id))
      .limit(1);
    const [usedInArchive] = usedInEvent
      ? [usedInEvent]
      : await tx
          .select({ id: eventArchives.eventId })
          .from(eventArchives)
          .where(eq(eventArchives.artistId, artist.id))
          .limit(1);

    if (usedInEvent || usedInArchive) {
      await tx.update(artists).set({ isDemo: false }).where(eq(artists.id, artist.id));
    } else {
      pushValidImage(imagePaths, artist.image);
      await tx.delete(artists).where(eq(artists.id, artist.id));
    }
  }

  return {
    events: eventIds.length,
    orders: deletedOrdersCount,
    imagePaths,
  };
}
