import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/check-in/route";
import { memberActor } from "../../helpers/actors";
import { setupTestDb, truncateAll } from "../../helpers/db";
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
});
