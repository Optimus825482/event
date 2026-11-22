import { describe, expect, it } from "vitest";
import { DomainError } from "@/lib/action";
import { pgCodeOf, pgConstraintOf, pgErrorInfo } from "@/lib/pg-error";

describe("pgErrorInfo (M10: tek PostgreSQL hata yürüyücüsü)", () => {
  it("doğrudan ve cause zincirindeki SQLSTATE kodu ile kısıt adını bulur", () => {
    expect(pgErrorInfo({ code: "23505", constraint: "x_uq" })).toEqual({ code: "23505", constraint: "x_uq" });
    const wrapped = new Error("sorgu", { cause: { code: "23503", constraint: "fk_a" } });
    expect(pgCodeOf(wrapped)).toBe("23503");
    expect(pgConstraintOf(wrapped)).toBe("fk_a");
  });

  it("SQLSTATE biçimi olmayan kodları (DomainError, Node hata kodları) veritabanı hatası saymaz", () => {
    expect(pgCodeOf(new DomainError("conflict", "x"))).toBeUndefined();
    expect(pgCodeOf({ code: "ECONNRESET" })).toBeUndefined();
    expect(pgCodeOf({ code: 23505 })).toBeUndefined();
  });

  it("biçimsiz kod zinciri kesmez: altındaki gerçek PostgreSQL hatası bulunur", () => {
    const wrapped = Object.assign(new Error("sarmal"), { code: "ECONNRESET", cause: { code: "23505", constraint: "u" } });
    expect(pgCodeOf(wrapped)).toBe("23505");
  });

  it("kısıtsız hata için kısıt undefined; hata olmayan değerler güvenli", () => {
    expect(pgConstraintOf({ code: "23514" })).toBeUndefined();
    expect(pgErrorInfo(null)).toBeUndefined();
    expect(pgErrorInfo("23505")).toBeUndefined();
  });

  it("döngüsel cause zincirinde sonsuz dönmez", () => {
    const a: { cause?: unknown } = {};
    a.cause = a;
    expect(pgErrorInfo(a)).toBeUndefined();
  });
});
