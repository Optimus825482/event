import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { getCheckInEvent } from "@/features/check-in/read-service";
import { setupTestDb, truncateAll } from "../../helpers/db";
import { doorActor } from "../../helpers/door";
import { bookedGuest } from "./fixtures";

describe("check-in etkinliği: bitiş anı (çevrimdışı kuyruk temizliği için)", () => {
  beforeAll(async () => {
    await setupTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  it("bitişi olan etkinlikte ends_at ISO olarak döner", async () => {
    const door = await doorActor();
    const { event } = await bookedGuest();
    const endsAt = new Date(event.startsAt.getTime() + 5 * 60 * 60_000);
    await db.update(events).set({ endsAt }).where(eq(events.id, event.id));
    expect((await getCheckInEvent(db, door, event.id)).endsAt).toBe(endsAt.toISOString());
  });

  it("bitişi olmayan etkinlikte başlangıç + 24 saat döner", async () => {
    const door = await doorActor();
    const { event } = await bookedGuest();
    await db.update(events).set({ endsAt: null }).where(eq(events.id, event.id));
    const loaded = await getCheckInEvent(db, door, event.id);
    expect(loaded.endsAt).toBe(new Date(event.startsAt.getTime() + 24 * 60 * 60_000).toISOString());
  });
});
