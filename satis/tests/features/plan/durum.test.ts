import { describe, expect, it } from "vitest";
import { availabilityEtag, durumResponse, unavailableResponse } from "@/features/plan/durum";

const a = { at: "2026-12-01T10:00:00.000Z", tables: [{ id: "t1", free: 5 }] };

describe("canlı durum yanıtı", () => {
  it("200: gövde, ETag ve önbellek başlığı", async () => {
    const res = durumResponse(a, null);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(a);
    expect(res.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(res.headers.get("ETag")).toBe(availabilityEtag(a));
  });

  it("ETag çift tırnaklıdır ve yalnızca masa durumuna bağlıdır", () => {
    expect(availabilityEtag(a)).toMatch(/^"[^"]+"$/);
    expect(availabilityEtag({ ...a, at: "2026-12-01T10:00:05.000Z" })).toBe(availabilityEtag(a));
    expect(availabilityEtag({ ...a, tables: [{ id: "t1", free: 4 }] })).not.toBe(availabilityEtag(a));
  });

  it("eşleşen If-None-Match 304 döner", async () => {
    const res = durumResponse(a, availabilityEtag(a));
    expect(res.status).toBe(304);
    expect(await res.text()).toBe("");
    expect(res.headers.get("ETag")).toBe(availabilityEtag(a));
    expect(res.headers.get("Cache-Control")).toBe("private, no-cache");
  });

  it("eşleşmeyen If-None-Match 200 döner", () => {
    expect(durumResponse(a, '"baska"').status).toBe(200);
  });

  it("bilinmeyen etkinlik 404 ve no-store", async () => {
    const res = durumResponse(null, null);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("çekirdek arızası 503 ve no-store", async () => {
    const res = unavailableResponse();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
