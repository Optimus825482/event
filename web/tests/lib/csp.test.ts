import { describe, expect, it } from "vitest";
import { buildCsp, generateNonce } from "@/lib/csp";

function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name = "", ...values] = part.split(/\s+/);
        return [name, values] as const;
      }),
  );
}

describe("generateNonce", () => {
  it("her çağrıda farklı, base64 ve yeterince uzun değer üretir", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(a.length).toBeGreaterThanOrEqual(22);
  });
});

describe("buildCsp", () => {
  it("üretim: sıkı betik ilkesi, unsafe-eval yok, upgrade-insecure-requests var", () => {
    const d = directives(buildCsp({ nonce: "abc", production: true }));
    expect(d.get("default-src")).toEqual(["'self'"]);
    expect(d.get("script-src")).toEqual(["'self'", "'nonce-abc'", "'strict-dynamic'"]);
    expect(d.has("upgrade-insecure-requests")).toBe(true);
  });

  it("geliştirme: yalnızca script-src'ye unsafe-eval eklenir, upgrade-insecure-requests yok", () => {
    const d = directives(buildCsp({ nonce: "abc", production: false }));
    expect(d.get("script-src")).toContain("'unsafe-eval'");
    expect(d.has("upgrade-insecure-requests")).toBe(false);
  });

  it("kaynak kısıtları: görsel, medya, worker, bağlantı, yazı tipi, nesne, base, form, çerçeve", () => {
    const d = directives(buildCsp({ nonce: "n", production: true }));
    expect(d.get("img-src")).toEqual(["'self'", "data:", "blob:"]);
    expect(d.get("media-src")).toEqual(["'self'", "blob:"]);
    expect(d.get("worker-src")).toEqual(["'self'", "blob:"]);
    expect(d.get("connect-src")).toEqual(["'self'"]);
    expect(d.get("font-src")).toEqual(["'self'", "data:"]);
    expect(d.get("object-src")).toEqual(["'none'"]);
    expect(d.get("base-uri")).toEqual(["'self'"]);
    expect(d.get("form-action")).toEqual(["'self'"]);
    expect(d.get("frame-ancestors")).toEqual(["'none'"]);
  });

  it("stil: <style> öğeleri nonce'lu; yalnızca stil ÖZNİTELİKLERİ (React style=) satır içi serbest", () => {
    const d = directives(buildCsp({ nonce: "n", production: true }));
    expect(d.get("style-src")).toEqual(["'self'", "'nonce-n'"]);
    expect(d.get("style-src-attr")).toEqual(["'unsafe-inline'"]);
    expect(d.get("style-src")).not.toContain("'unsafe-inline'");
  });

  it("geliştirme: HMR'nin enjekte ettiği <style> için nonce'suz unsafe-inline (nonce olsaydı yok sayılırdı)", () => {
    const d = directives(buildCsp({ nonce: "n", production: false }));
    expect(d.get("style-src")).toEqual(["'self'", "'unsafe-inline'"]);
  });

  it("hiçbir yönergede joker (*) veya unsafe-inline betik izni yok", () => {
    const policy = buildCsp({ nonce: "n", production: true });
    expect(policy).not.toContain("*");
    expect(directives(policy).get("script-src")).not.toContain("'unsafe-inline'");
  });
});
