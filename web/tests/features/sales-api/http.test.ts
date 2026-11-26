import { describe, expect, it } from "vitest";
import { z } from "zod";
import { readJsonBody, salesFailure, toSalesResponse } from "@/features/sales-api/http";
import { SalesError } from "@/features/ticketing/orders-service";

const schema = z.strictObject({ name: z.string().min(1), n: z.number().int() });
const post = (raw: string) => new Request("http://localhost/x", { method: "POST", body: raw });

describe("satış API http çerçevesi", () => {
  it("hata gövdesi ve durum sözleşmedeki gibidir", async () => {
    const res = salesFailure("seats_unavailable", { details: { tableId: "t", free: 2 } });
    expect(res.status).toBe(409);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(await res.json()).toEqual({
      error: { code: "seats_unavailable", message: "Seçilen masada yeterli boş sandalye yok", details: { tableId: "t", free: 2 } },
    });
  });

  it("SalesError kendi koduna, beklenmeyen hata ayrıntısız 500'e çevrilir", async () => {
    const known = toSalesResponse(new SalesError("hold_expired"));
    expect(known.status).toBe(409);
    const unknown = toSalesResponse(new Error("select * from orders patladı"));
    expect(unknown.status).toBe(500);
    const text = await unknown.text();
    expect(JSON.parse(text)).toEqual({ error: { code: "internal", message: "Beklenmeyen bir hata oluştu" } });
    expect(text).not.toContain("orders");
  });

  it("gövde okuma: bozuk JSON, şema hatası ve 16 KB üstü 400 invalid", async () => {
    const broken = await readJsonBody(post("{"), schema);
    expect(broken.ok).toBe(false);
    if (!broken.ok) {
      expect(broken.response.status).toBe(400);
      expect(((await broken.response.json()) as { error: { code: string } }).error.code).toBe("invalid");
    }

    const bad = await readJsonBody(post(JSON.stringify({ name: "", n: 1.5, extra: 1 })), schema);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      const body = (await bad.response.json()) as { error: { details: { fieldErrors: Record<string, string[]> } } };
      expect(Object.keys(body.error.details.fieldErrors).length).toBeGreaterThan(0);
      expect(body.error.details.fieldErrors.name?.length).toBeGreaterThan(0);
    }

    const big = await readJsonBody(post(JSON.stringify({ name: "a".repeat(17 * 1024), n: 1 })), schema);
    expect(big.ok).toBe(false);
    if (!big.ok) expect(big.response.status).toBe(400);

    const ok = await readJsonBody(post(JSON.stringify({ name: "x", n: 2 })), schema);
    expect(ok).toEqual({ ok: true, data: { name: "x", n: 2 } });
  });
});
