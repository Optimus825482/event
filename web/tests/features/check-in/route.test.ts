import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/check-in/route";
import { db } from "@/db/client";
import { tickets } from "@/db/schema";
import { memberActor } from "../../helpers/actors";
import { setupTestDb, truncateAll } from "../../helpers/db";
import { addPaidOrder, ticketedEvent, ticketLog, ticketRow } from "../../helpers/door";
import { loginAs } from "../realtime/helpers";
import { bookedGuest, customerRow, key, reservationRow, setReservationStatus } from "./fixtures";

const URL = "http://localhost:3000/api/check-in";

function post(
  body: unknown,
  options: {
    cookie?: string;
    headers?: Record<string, string>;
    raw?: string;
  } = {},
) {
  const headers = new Headers({
    "content-type": "application/json",
    origin: "http://localhost:3000",
    ...options.headers,
  });
  if (options.cookie) headers.set("cookie", options.cookie);
  return POST(
    new Request(URL, {
      method: "POST",
      headers,
      body: options.raw ?? JSON.stringify(body),
    }),
  );
}

describe("POST /api/check-in", () => {
  beforeAll(async () => {
    await setupTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  it("oturumsuz istek 401 JSON alır ve hiçbir şey yazmaz", async () => {
    const { event, reservation } = await bookedGuest();
    const res = await post({
      eventId: event.id,
      idempotencyKey: key(),
      token: reservation.qrToken,
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      ok: false,
      code: "unauthenticated",
      message: "Oturum gerekli",
    });
    expect((await reservationRow(reservation.id)).status).toBe("confirmed");
  });

  it("check_in izni olmayan kullanıcı 403 alır (departman ya da kullanıcı izni)", async () => {
    const { event, reservation } = await bookedGuest();
    const body = {
      eventId: event.id,
      idempotencyKey: key(),
      token: reservation.qrToken,
    };
    const outsider = await loginAs(memberActor("fnb", { venues: "vced" }));
    expect((await post(body, { cookie: outsider.cookie })).status).toBe(403);
    // Yalnızca görüntüleme izni var, oluşturma yok.
    const staff = await loginAs(memberActor("casino", { check_in: "v---" }));
    const res = await post(body, { cookie: staff.cookie });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ ok: false, code: "forbidden" });
    expect((await reservationRow(reservation.id)).status).toBe("confirmed");
  });

  it("JSON olmayan içerik 415, başka kaynaktan istek 403, bozuk gövde ve 50'den büyük toplu istek 400", async () => {
    const door = await loginAs(memberActor("casino", { check_in: "vc--" }));
    const item = { eventId: randomUUID(), idempotencyKey: key(), token: "x" };
    expect(
      (
        await post(item, {
          cookie: door.cookie,
          headers: { "content-type": "text/plain" },
        })
      ).status,
    ).toBe(415);
    expect(
      (
        await post(item, {
          cookie: door.cookie,
          headers: { origin: "https://kotu.example" },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await post(item, {
          cookie: door.cookie,
          headers: { "sec-fetch-site": "cross-site" },
        })
      ).status,
    ).toBe(403);
    expect((await post(null, { cookie: door.cookie, raw: "{bozuk" })).status).toBe(400);
    expect((await post("metin", { cookie: door.cookie })).status).toBe(400);
    expect((await post({ items: [] }, { cookie: door.cookie })).status).toBe(400);
    const tooMany = Array.from({ length: 51 }, () => ({
      ...item,
      idempotencyKey: key(),
    }));
    const res = await post({ items: tooMany }, { cookie: door.cookie });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, code: "invalid" });
  });

  it("toplu istek: ownerId oturumdaki kullanıcıyla uyuşmazsa 401 alır ve hiçbir şey işlenmez", async () => {
    const { event, reservation } = await bookedGuest();
    const door = await loginAs(memberActor("casino", { check_in: "vc--" }));
    const item = { eventId: event.id, idempotencyKey: key(), token: reservation.qrToken };

    const foreign = await post({ ownerId: randomUUID(), items: [item] }, { cookie: door.cookie });
    expect(foreign.status).toBe(401);
    expect(await foreign.json()).toMatchObject({ ok: false, code: "unauthenticated" });
    expect((await reservationRow(reservation.id)).status).toBe("confirmed");

    const own = await post({ ownerId: door.id, items: [item] }, { cookie: door.cookie });
    expect(own.status).toBe(200);
    expect((await reservationRow(reservation.id)).status).toBe("checked_in");
  });

  it("tek öğe: 200 ve action ile aynı sonuç biçimi; aynı anahtarla tekrar aynı yanıt", async () => {
    const { event, customer, reservation } = await bookedGuest();
    const door = await loginAs(memberActor("casino", { check_in: "vc--" }));
    const body = {
      eventId: event.id,
      idempotencyKey: key(),
      token: reservation.qrToken,
      clientTimestamp: new Date().toISOString(),
    };

    const res = await post(body, { cookie: door.cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const json: unknown = await res.json();
    expect(json).toMatchObject({
      ok: true,
      data: {
        outcome: "checked_in",
        reservationId: reservation.id,
        tableLabel: "A1",
      },
    });

    const again: unknown = await (await post(body, { cookie: door.cookie })).json();
    expect(again).toEqual(json);
    expect((await customerRow(customer.id)).totalAttendedEvents).toBe(1);
  });

  it("toplu istek: her öğe bağımsız, kendi sonucuyla ve aynı sırayla döner", async () => {
    const a = await bookedGuest();
    const b = await bookedGuest();
    const door = await loginAs(memberActor("casino", { check_in: "vc--" }));
    const cancelled = await bookedGuest();
    await setReservationStatus(cancelled.reservation.id, "cancelled");
    const sharedKey = key();

    const items = [
      {
        eventId: a.event.id,
        idempotencyKey: sharedKey,
        token: a.reservation.qrToken,
      },
      {
        eventId: a.event.id,
        idempotencyKey: key(),
        token: a.reservation.qrToken,
      },
      {
        eventId: cancelled.event.id,
        idempotencyKey: key(),
        token: cancelled.reservation.qrToken,
      },
      {
        eventId: b.event.id,
        idempotencyKey: key(),
        token: a.reservation.qrToken,
      },
      {
        eventId: b.event.id,
        idempotencyKey: "anahtar-degil",
        token: b.reservation.qrToken,
      },
      {
        eventId: a.event.id,
        idempotencyKey: sharedKey,
        token: a.reservation.qrToken,
      },
    ];
    const res = await post({ items }, { cookie: door.cookie });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      results: Array<{
        idempotencyKey: string | null;
        result: Record<string, unknown>;
      }>;
    };
    expect(json.results.map((r) => r.idempotencyKey)).toEqual([
      sharedKey,
      items[1]?.idempotencyKey,
      items[2]?.idempotencyKey,
      items[3]?.idempotencyKey,
      null,
      sharedKey,
    ]);
    const summary = json.results.map(({ result }) =>
      result.ok ? (result.data as { outcome: string }).outcome : `${String(result.code)}`,
    );
    expect(summary).toEqual(["checked_in", "already_checked_in", "conflict", "conflict", "invalid", "checked_in"]);
    expect(json.results[5]?.result).toEqual(json.results[0]?.result);
    expect(json.results[4]?.result).toMatchObject({
      fieldErrors: { idempotencyKey: ["Geçersiz istek anahtarı"] },
    });
    expect((await reservationRow(b.reservation.id)).status).toBe("confirmed");
  });

  type BatchJson = { results: Array<{ idempotencyKey: string | null; result: { ok: boolean; data?: Record<string, unknown> } }> };

  it("toplu istek: siparişin üç bileti tek istekte, bilet başına ayrı anahtarla girer", async () => {
    const te = await ticketedEvent();
    const door = await loginAs(memberActor("casino", { check_in: "vc--" }));
    const items = te.tickets.map((t) => ({ eventId: te.event.id, idempotencyKey: key(), ticketId: t.ticketId, gate: 1 }));
    const res = await post({ items }, { cookie: door.cookie });
    expect(res.status).toBe(200);
    const json = (await res.json()) as BatchJson;
    expect(json.results).toHaveLength(3);
    for (const r of json.results) {
      expect(r.result.ok).toBe(true);
      expect(r.result.data).toMatchObject({ kind: "ticket", outcome: "checked_in" });
    }
    for (const t of te.tickets) {
      const row = await ticketRow(t.ticketId);
      expect(row.checkedInAt).not.toBeNull();
      expect(row.checkInGate).toBe(1);
    }
  });

  it("toplu isteğin aynen tekrarı (kaybolan yanıt): aynı sonuçlar, bilet başına tek kayıt", async () => {
    const te = await ticketedEvent();
    const door = await loginAs(memberActor("casino", { check_in: "vc--" }));
    const items = te.tickets.map((t) => ({ eventId: te.event.id, idempotencyKey: key(), ticketId: t.ticketId }));
    const first = (await (await post({ items }, { cookie: door.cookie })).json()) as BatchJson;
    const second = (await (await post({ items }, { cookie: door.cookie })).json()) as BatchJson;
    expect(second.results).toEqual(first.results);
    for (const t of te.tickets) expect(await ticketLog(t.ticketId)).toHaveLength(1);
  });

  it("kapı gecesi yükü: üç kapıdan 50'şer öğelik eşzamanlı toplu istek", async () => {
    const te = await ticketedEvent({ seats: [1] });
    for (let i = 0; i < 10; i++) await addPaidOrder(te.event.id, [{ label: `Y${i}`, quantity: 10 }]);
    const all = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(eq(tickets.eventId, te.event.id))
      .orderBy(asc(tickets.createdAt), asc(tickets.id));
    // İlk bilet ticketedEvent'ten; yük için 100 bilet kullanılır.
    const ids = all.slice(0, 100).map((t) => t.id);
    expect(ids).toHaveLength(100);
    const sessions = await Promise.all([1, 2, 3].map(() => loginAs(memberActor("casino", { check_in: "vc--" }))));
    const batch = (list: string[], gate: number) => list.map((id) => ({ eventId: te.event.id, idempotencyKey: key(), ticketId: id, gate }));
    const first50 = ids.slice(0, 50);
    const rest = ids.slice(50);
    const responses = await Promise.all([
      post({ items: batch(first50, 1) }, { cookie: sessions[0]!.cookie }),
      post({ items: batch(first50, 2) }, { cookie: sessions[1]!.cookie }),
      post({ items: batch(rest, 3) }, { cookie: sessions[2]!.cookie }),
    ]);
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    const results = (await Promise.all(responses.map((r) => r.json() as Promise<BatchJson>))).flatMap((j) => j.results);
    expect(results).toHaveLength(150);
    expect(results.every((r) => r.result.ok)).toBe(true);
    const counts: Record<string, number> = {};
    for (const r of results) {
      const o = String(r.result.data?.outcome);
      counts[o] = (counts[o] ?? 0) + 1;
    }
    expect(counts).toEqual({ checked_in: 100, already_checked_in: 50 });
    const rows = await db.select({ at: tickets.checkedInAt }).from(tickets).where(eq(tickets.eventId, te.event.id));
    expect(rows.filter((r) => r.at !== null)).toHaveLength(100);
  }, 60_000);
});
