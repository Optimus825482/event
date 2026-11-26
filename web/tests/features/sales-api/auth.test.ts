import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkSalesAuth, salesClientIp } from "@/features/sales-api/auth";

const secret = randomBytes(24).toString("hex");
const h = (value?: string) => new Headers(value === undefined ? {} : { authorization: value });

describe("satış API kimliği", () => {
  it("doğru sır kabul edilir", () => expect(checkSalesAuth(h(`Bearer ${secret}`), secret)).toEqual({ ok: true }));
  it.each([undefined, "", secret, `Bearer ${secret}x`, `Bearer ${secret.slice(1)}`, `bearer ${secret}`, `Basic ${secret}`, "Bearer "])(
    "başlık %j → unauthorized",
    (value) => expect(checkSalesAuth(h(value), secret)).toEqual({ ok: false, code: "unauthorized" }),
  );
  it("sunucuda sır tanımsızsa doğru görünen başlık da sales_api_disabled", () =>
    expect(checkSalesAuth(h(`Bearer ${secret}`), undefined)).toEqual({ ok: false, code: "sales_api_disabled" }));
  it.each([
    ["203.0.113.7", "203.0.113.7"],
    ["2001:db8::1", "2001:db8::1"],
    [" 203.0.113.7 ", "203.0.113.7"],
    ["1.2.3.4, 5.6.7.8", "unknown"],
    ["'; drop table", "unknown"],
    ["x".repeat(500), "unknown"],
  ])("istemci IP'si %j → %j", (value, key) =>
    expect(salesClientIp(new Headers({ "x-sales-client-ip": value }))).toBe(key),
  );
  it.each(["", "kisa-sir"])("sır %j çok kısaysa sales_api_disabled; boş sır + Bearer kabul edilmez", (short) => {
    expect(checkSalesAuth(h("Bearer "), short)).toEqual({ ok: false, code: "sales_api_disabled" });
    expect(checkSalesAuth(h(`Bearer ${short}`), short)).toEqual({ ok: false, code: "sales_api_disabled" });
  });
  it("başlık yoksa anahtar unknown", () => expect(salesClientIp(new Headers())).toBe("unknown"));
});
