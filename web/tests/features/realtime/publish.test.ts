import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { MAX_PAYLOAD_BYTES, RealtimePayloadError, type RealtimeEvent } from "@/features/realtime/events";
import { listenerCount, subscribe, type StreamMessage } from "@/features/realtime/hub";
import { closeRealtime, ensureListening } from "@/features/realtime/listener";
import { publish } from "@/features/realtime/publish";
import type { Audience } from "@/features/notifications/schemas";
import { visibleAudiences } from "@/features/notifications/service";
import { adminActor, managerActor, memberActor } from "../../helpers/actors";
import { waitFor } from "./helpers";

function collect(eventId: string, audiences?: readonly Audience[]) {
  const messages: StreamMessage[] = [];
  const unsubscribe = subscribe(eventId, (message) => messages.push(message), { audiences });
  const ids = () => messages.flatMap((m) => (m.kind === "event" && m.event.id ? [m.event.id] : []));
  return { messages, unsubscribe, ids };
}

const cleanups: Array<() => void> = [];

describe("publish + paylaşımlı LISTEN bağlantısı", () => {
  beforeAll(async () => {
    await ensureListening();
  });
  afterEach(() => {
    while (cleanups.length > 0) cleanups.pop()?.();
    expect(listenerCount()).toBe(0);
  });
  afterAll(async () => {
    await closeRealtime();
  });

  it("geri alınan transaction olay yaymaz; commit edilen tam bir kez yayar", async () => {
    const eventId = randomUUID();
    const sub = collect(eventId);
    cleanups.push(sub.unsubscribe);

    await expect(
      db.transaction(async (tx) => {
        await publish(tx, { type: "reservation.changed", eventId, id: "geri-alinan" });
        throw new Error("geri al");
      }),
    ).rejects.toThrow("geri al");

    await db.transaction(async (tx) => {
      await publish(tx, { type: "reservation.changed", eventId, id: "commit-edilen" });
      // Commit'ten önce dağıtım olmaz.
      await tx.execute(sql`select pg_sleep(0.05)`);
      expect(sub.ids()).toEqual([]);
    });
    await publish(db, { type: "stats.updated", eventId, id: "isaretci" });

    // Bildirimler commit sırasıyla gelir: işaretçi geldiyse öncekiler de gelmiştir.
    await waitFor(() => sub.ids().includes("isaretci"), 5000, "işaretçi olayı");
    expect(sub.ids()).toEqual(["commit-edilen", "isaretci"]);

    const [first] = sub.messages;
    expect(first).toMatchObject({ kind: "event", event: { type: "reservation.changed", eventId } });
    if (first?.kind === "event") expect(Number.isNaN(Date.parse(first.event.at))).toBe(false);
  });

  it("A etkinliğinin olayı B aboneliğine ulaşmaz", async () => {
    const a = randomUUID();
    const b = randomUUID();
    const subB = collect(b);
    cleanups.push(subB.unsubscribe);

    await publish(db, { type: "table.updated", eventId: a, id: "a-masasi" });
    await publish(db, { type: "table.updated", eventId: b, id: "b-masasi" });

    await waitFor(() => subB.ids().includes("b-masasi"), 5000, "B olayı");
    expect(subB.ids()).toEqual(["b-masasi"]);
  });

  it("hub: fnb hedefli olay yalnızca fnb üyesi ve admin abonelere ulaşır", async () => {
    const multi = memberActor("fnb", {}, {
      memberships: [
        { department: "casino", level: "member" },
        { department: "fnb", level: "member" },
      ],
    });
    const fnbSub = collect(randomUUID(), visibleAudiences(managerActor("fnb")));
    const adminSub = collect(randomUUID(), visibleAudiences(adminActor()));
    const casinoSub = collect(randomUUID(), visibleAudiences(managerActor("casino")));
    const multiSub = collect(randomUUID(), visibleAudiences(multi));
    const anonymousSub = collect(randomUUID());
    cleanups.push(fnbSub.unsubscribe, adminSub.unsubscribe, casinoSub.unsubscribe, multiSub.unsubscribe, anonymousSub.unsubscribe);

    await publish(db, { type: "notification.created", audience: "fnb", id: "yalniz-fnb" });
    await publish(db, { type: "notification.created", audience: "admin", id: "yalniz-admin" });
    await publish(db, { type: "notification.created", audience: "all", id: "herkese" });

    for (const sub of [fnbSub, adminSub, casinoSub, multiSub, anonymousSub]) {
      await waitFor(() => sub.ids().includes("herkese"), 5000, "herkese bildirimi");
    }
    expect(fnbSub.ids()).toEqual(["yalniz-fnb", "herkese"]);
    expect(adminSub.ids()).toEqual(["yalniz-fnb", "yalniz-admin", "herkese"]);
    expect(casinoSub.ids()).toEqual(["herkese"]);
    expect(multiSub.ids()).toEqual(["yalniz-fnb", "herkese"]);
    // Kitlesi bilinmeyen abonelik yalnızca "all" bildirimini alır.
    expect(anonymousSub.ids()).toEqual(["herkese"]);
  });

  it("aşırı büyük veya kurala uymayan yük reddedilir ve hiçbir şey yayılmaz", async () => {
    const eventId = randomUUID();
    const sub = collect(eventId);
    cleanups.push(sub.unsubscribe);

    const huge = "a".repeat(MAX_PAYLOAD_BYTES);
    await expect(publish(db, { type: "reservation.changed", eventId, id: huge })).rejects.toBeInstanceOf(
      RealtimePayloadError,
    );
    const bad = { type: "reservation.changed", eventId: "uuid-degil" } as unknown as RealtimeEvent;
    await expect(publish(db, bad)).rejects.toBeInstanceOf(RealtimePayloadError);
    // Kimlik alanına kişisel veri (boşluk, @, +) konamaz.
    await expect(
      publish(db, { type: "guest.checked_in", eventId, id: "ayse@example.com" }),
    ).rejects.toBeInstanceOf(RealtimePayloadError);

    await publish(db, { type: "stats.updated", eventId, id: "isaretci" });
    await waitFor(() => sub.ids().includes("isaretci"), 5000, "işaretçi olayı");
    expect(sub.ids()).toEqual(["isaretci"]);
  });

  it("LISTEN bağlantısı koparsa yeniden bağlanır ve abonelere resync gönderir", async () => {
    const eventId = randomUUID();
    const sub = collect(eventId);
    cleanups.push(sub.unsubscribe);

    const killed = await db.execute<{ ok: boolean }>(sql`
      select pg_terminate_backend(pid) as ok from pg_stat_activity
      where datname = current_database() and pid <> pg_backend_pid() and query ilike 'listen %'`);
    expect(killed.rows.length).toBeGreaterThan(0);

    await waitFor(() => sub.messages.some((m) => m.kind === "resync"), 10_000, "resync");
    await ensureListening();
    await publish(db, { type: "stats.updated", eventId, id: "yeniden-baglandi" });
    await waitFor(() => sub.ids().includes("yeniden-baglandi"), 5000, "yeniden bağlantı sonrası olay");
  });
});
