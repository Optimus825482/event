import { describe, expect, it } from "vitest";
import { buildCsp, generateNonce } from "@/lib/csp";

describe("CSP", () => {
  it("tarayıcı yalnızca kendi kökenine bağlanabilir", () => {
    const csp = buildCsp({ nonce: "N", production: true });
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("script-src 'self' 'nonce-N' 'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toContain("unsafe-eval");
  });
  it("geliştirmede unsafe-eval yalnızca script-src içindedir", () => {
    const csp = buildCsp({ nonce: "N", production: false });
    expect(csp).toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(csp.match(/unsafe-eval/g)).toHaveLength(1);
  });
  it("media-src ve worker-src yoktur; img-src yalnızca self ve data", () => {
    const csp = buildCsp({ nonce: "N", production: true });
    expect(csp).not.toContain("media-src");
    expect(csp).not.toContain("worker-src");
    expect(csp).toContain("img-src 'self' data:");
  });
  it("nonce her çağrıda farklıdır", () => expect(generateNonce()).not.toBe(generateNonce()));
  it("yazı tipi ve görsel yalnızca kendi kökenimizden; tek dış köken frame-src'teki Google Haritalar'dır", () => {
    const csp = buildCsp({ nonce: "N", production: true });
    expect(csp).toContain("font-src 'self' data:");
    expect(csp).toContain("frame-src https://www.google.com");
    const others = csp
      .split(";")
      .map((d) => d.trim())
      .filter((d) => !d.startsWith("frame-src "));
    expect(others.join("; ")).not.toMatch(/https?:\/\//);
    expect(csp.match(/https?:\/\/[^\s;]+/g)).toEqual(["https://www.google.com"]);
  });
});
