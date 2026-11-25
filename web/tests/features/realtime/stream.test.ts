import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/events/[eventId]/stream/route";
import { db } from "@/db/client";
import { listenerCount } from "@/features/realtime/hub";
import { closeRealtime } from "@/features/realtime/listener";
import { publish } from "@/features/realtime/publish";
import { MAX_STREAMS_PER_USER } from "@/features/realtime/stream";
import { memberActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { createEvent } from "../../helpers/factories";
import { loginAs, sseReader, waitFor } from "./helpers";

const open: AbortController[] = [];

function connect(eventId: string, cookie?: string) {
  const controller = new AbortController();
  open.push(controller);
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  const request = new Request(`http://localhost:3000/api/events/${eventId}/stream`, {
    headers,
    signal: controller.signal,
  });
  return { controller, response: GET(request, { params: Promise.resolve({ eventId }) }) };
}

describe("GET /api/events/[eventId]/stream", () => {
  beforeEach(async () => {
    await truncateAll();
  });
  afterEach(async () => {
    while (open.length > 0) open.pop()?.abort();
    await waitFor(() => listenerCount() === 0, 2000, "dinleyicilerin temizlenmesi");
  });
  afterAll(async () => {
    await closeRealtime();
  });

  it("oturumsuz bağlantı 401 alır", async () => {
    const event = await createEvent(db);
    const res = await connect(event.id).response;
    expect(res.status).toBe(401);
    expect(listenerCount()).toBe(0);
  });

  it("check_in:view ve reservations:view izni olmayan kullanıcı 403 alır", async () => {
    const event = await createEvent(db);
    const owner = await loginAs("venue_owner");
    expect((await connect(event.id, owner.cookie).response).status).toBe(403);

    // Kullanıcıda iki modülün görüntüleme izni kapalıysa 403.
    const staff = await loginAs(memberActor("casino", { check_in: "----", reservations: "----" }));
    expect((await connect(event.id, staff.cookie).response).status).toBe(403);
    expect(listenerCount()).toBe(0);
  });

  it("başka organizatörün etkinliği, olmayan etkinlik ve geçersiz kimlik 404 olur", async () => {
    const organizer = await loginAs("organizer");
    const foreign = await createEvent(db);
    expect((await connect(foreign.id, organizer.cookie).response).status).toBe(404);
    expect((await connect(randomUUID(), organizer.cookie).response).status).toBe(404);
    expect((await connect("uuid-degil", organizer.cookie).response).status).toBe(404);
    expect(listenerCount()).toBe(0);
  });

  it("yetkili akış SSE başlıklarıyla açılır, kendi etkinliğinin olaylarını alır, başkasınınkini almaz", async () => {
    const organizer = await loginAs("organizer");
    const mine = await createEvent(db, { organizerId: organizer.id });
    const other = await createEvent(db, { organizerId: organizer.id });

    const res = await connect(mine.id, organizer.cookie).response;
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-store, no-transform");
    expect(res.headers.get("x-accel-buffering")).toBe("no");
    if (!res.body) throw new Error("gövde yok");
    const sse = sseReader(res.body);
    expect(await sse.first()).toMatch(/^retry: \d+\n/);
    expect(listenerCount(mine.id)).toBe(1);

    await publish(db, { type: "reservation.changed", eventId: other.id, id: "baska" });
    await publish(db, { type: "guest.checked_in", eventId: mine.id, id: "benim" });

    const frames = await sse.until((f) => f.event === "guest.checked_in");
    expect(frames.map((f) => f.event)).toEqual(["guest.checked_in"]);
    expect(JSON.parse(frames[0]?.data ?? "{}")).toMatchObject({ type: "guest.checked_in", eventId: mine.id, id: "benim" });
  });

  it("istek iptal edilince dinleyici kaldırılır; okuyucu iptali de kaldırır", async () => {
    const staff = await loginAs(memberActor("casino", { reservations: "vce-", customers: "v---", check_in: "vc--" }));
    const event = await createEvent(db);

    const first = connect(event.id, staff.cookie);
    const res = await first.response;
    expect(res.status).toBe(200);
    expect(listenerCount(event.id)).toBe(1);
    first.controller.abort();
    await waitFor(() => listenerCount(event.id) === 0, 2000, "abort sonrası temizlik");

    const second = await connect(event.id, staff.cookie).response;
    if (!second.body) throw new Error("gövde yok");
    expect(listenerCount(event.id)).toBe(1);
    await second.body.cancel();
    await waitFor(() => listenerCount(event.id) === 0, 2000, "cancel sonrası temizlik");
  });

  it(`kullanıcı başına en çok ${MAX_STREAMS_PER_USER} eşzamanlı akış; fazlası 429`, async () => {
    const staff = await loginAs(memberActor("casino", { reservations: "vce-", customers: "v---", check_in: "vc--" }));
    const event = await createEvent(db);

    const streams = [];
    for (let i = 0; i < MAX_STREAMS_PER_USER; i += 1) {
      const conn = connect(event.id, staff.cookie);
      expect((await conn.response).status).toBe(200);
      streams.push(conn);
    }
    expect((await connect(event.id, staff.cookie).response).status).toBe(429);

    streams[0]?.controller.abort();
    await waitFor(() => listenerCount(event.id) === MAX_STREAMS_PER_USER - 1, 2000, "bir akışın kapanması");
    expect((await connect(event.id, staff.cookie).response).status).toBe(200);
  });
});
