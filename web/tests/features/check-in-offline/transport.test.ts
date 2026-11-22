import { describe, expect, it } from "vitest";
import { sendBatch } from "@/features/check-in/offline/transport";
import { EVENT_ID, item, success, USER_ID, walkInItem } from "./helpers";

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
