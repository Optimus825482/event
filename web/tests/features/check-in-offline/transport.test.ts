import { describe, expect, it, vi } from "vitest";
import { sendBatch } from "@/features/check-in/offline/transport";
import { EVENT_ID, item, success, ticketItem, USER_ID, walkInItem } from "./helpers";

describe("sendBatch: walk-in öğesi", () => {
  it("walk-in hedefi kind=walk_in olarak, alanlarıyla ve aynı anahtar/zaman damgasıyla gönderilir", async () => {
    const tableId = "22222222-2222-4222-8222-222222222222";
    const w = walkInItem({ guestName: "Kapı", guestCount: 2, tableId });
    let body = "";
    const fake: typeof fetch = async (_input, init) => {
      body = String(init?.body);
      return Response.json({ results: [{ idempotencyKey: w.idempotencyKey, result: { ok: true, data: success() } }] });
    };
    await sendBatch([w], fake);
    expect(JSON.parse(body)).toEqual({
      ownerId: USER_ID,
      items: [
        {
          kind: "walk_in",
          eventId: EVENT_ID,
          idempotencyKey: w.idempotencyKey,
          clientTimestamp: w.clientTimestamp,
          tableId,
          guestName: "Kapı",
          guestCount: 2,
        },
      ],
    });
  });
});

function fetchReturning(response: Response | Error): typeof fetch {
  return async () => {
    if (response instanceof Error) throw response;
    return response;
  };
}

describe("sendBatch", () => {
  it("tek bir JSON gövdesinde anahtar, zaman damgası ve hedefle gönderir", async () => {
    const a = item({ token: "tok.sig" });
    let captured: { url: string; init: RequestInit | undefined } | null = null;
    const fake: typeof fetch = async (input, init) => {
      captured = { url: String(input), init };
      return Response.json({ results: [{ idempotencyKey: a.idempotencyKey, result: { ok: true, data: success() } }] });
    };
    const outcome = await sendBatch([a], fake);
    expect(outcome.kind).toBe("results");
    const request = captured as { url: string; init: RequestInit | undefined } | null;
    expect(request?.url).toBe("/api/check-in");
    expect(request?.init?.method).toBe("POST");
    expect(new Headers(request?.init?.headers).get("content-type")).toBe("application/json");
    expect(request?.init?.credentials).toBe("same-origin");
    expect(JSON.parse(String(request?.init?.body))).toEqual({
      ownerId: USER_ID,
      items: [
        { eventId: EVENT_ID, idempotencyKey: a.idempotencyKey, clientTimestamp: a.clientTimestamp, token: "tok.sig" },
      ],
    });
  });

  it("ağ hatası -> network", async () => {
    expect(await sendBatch([item()], fetchReturning(new TypeError("Failed to fetch")))).toEqual({ kind: "network" });
  });

  it("401 -> unauthenticated", async () => {
    const res = Response.json({ ok: false, code: "unauthenticated", message: "Oturum gerekli" }, { status: 401 });
    expect(await sendBatch([item()], fetchReturning(res))).toEqual({ kind: "unauthenticated" });
  });

  it.each([500, 502, 503, 408, 429])("%i -> retry", async (status) => {
    expect(await sendBatch([item()], fetchReturning(new Response("x", { status })))).toEqual({ kind: "retry", status });
  });

  it.each([400, 403, 413, 415])("%i -> rejected (öğe silinmez)", async (status) => {
    const res = Response.json({ ok: false, code: "forbidden", message: "Yetki yok" }, { status });
    expect(await sendBatch([item()], fetchReturning(res))).toEqual({ kind: "rejected", status, message: "Yetki yok" });
  });

  it("200 ama JSON olmayan gövde (örn. gezgin portal sayfası) -> retry, kalıcı hata DEĞİL", async () => {
    const res = new Response("<html>Wi-Fi giriş</html>", { status: 200, headers: { "content-type": "text/html" } });
    expect(await sendBatch([item()], fetchReturning(res))).toEqual({ kind: "retry", status: 200 });
  });

  it("200 ama beklenmeyen şekil -> retry", async () => {
    expect(await sendBatch([item()], fetchReturning(Response.json({ foo: 1 })))).toEqual({ kind: "retry", status: 200 });
  });

  it("yönlendirme (opaqueredirect) -> network benzeri yeniden deneme", async () => {
    const opaque = { type: "opaqueredirect", status: 0 } as unknown as Response;
    expect(await sendBatch([item()], fetchReturning(opaque))).toEqual({ kind: "network" });
  });
});

describe("sendBatch: bilet ve kapı", () => {
  const ticketData = {
    outcome: "checked_in",
    kind: "ticket",
    reservationId: null,
    ticketId: "t-1",
    pnr: "ABCD2345",
    gate: 2,
    eventId: EVENT_ID,
    guestName: "Bilet Sahibi",
    guestCount: 1,
    tableId: "tb1",
    tableLabel: "B7",
    checkedInAt: new Date(1_000).toISOString(),
    checkedInBy: null,
  };

  it("bilet öğesi ticketId ve kapıyla gönderilir", async () => {
    const t = ticketItem({ ticketId: "t-1", gate: 2, key: "k-1" });
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ results: [] }));
    await sendBatch([t], fetchImpl);
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body.items).toEqual([
      { eventId: EVENT_ID, idempotencyKey: "k-1", clientTimestamp: t.clientTimestamp, ticketId: "t-1", gate: 2 },
    ]);
  });

  it("kapısız öğede gate alanı gönderilmez", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ results: [] }));
    await sendBatch([ticketItem({ ticketId: "t-1" }), item()], fetchImpl);
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    for (const wire of body.items) expect(wire).not.toHaveProperty("gate");
  });

  it("bilet yanıtı (reservationId null, kind ticket) kuyrukta başarı olarak okunur", async () => {
    const t = ticketItem({ ticketId: "t-1", gate: 2, key: "k-1" });
    const fake: typeof fetch = async () =>
      Response.json({ results: [{ idempotencyKey: "k-1", result: { ok: true, data: ticketData } }] });
    const outcome = await sendBatch([t], fake);
    expect(outcome.kind).toBe("results");
    if (outcome.kind !== "results") return;
    const result = outcome.results[0]!.result;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({ kind: "ticket", ticketId: "t-1", reservationId: null, pnr: "ABCD2345", gate: 2 });
  });

  it("eski biçimli yanıt (kind yok) rezervasyon olarak okunur", async () => {
    const legacy: Record<string, unknown> = { ...ticketData };
    for (const field of ["kind", "ticketId", "pnr", "gate"]) delete legacy[field];
    const fake: typeof fetch = async () =>
      Response.json({ results: [{ idempotencyKey: "k-1", result: { ok: true, data: { ...legacy, reservationId: "r1" } } }] });
    const outcome = await sendBatch([item({ key: "k-1" })], fake);
    if (outcome.kind !== "results") throw new Error("results bekleniyordu");
    const result = outcome.results[0]!.result;
    if (!result.ok) throw new Error("başarı bekleniyordu");
    expect(result.data).toMatchObject({ kind: "reservation", ticketId: null, pnr: null, gate: null });
  });
});
