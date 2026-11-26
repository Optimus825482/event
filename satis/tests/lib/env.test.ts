import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

const ok = {
  CORE_API_URL: "http://core:3000/",
  SALES_API_SECRET: "s".repeat(32),
  SITE_URL: "http://localhost:3370",
  NODE_ENV: "test",
};

describe("parseEnv", () => {
  it("geçerli ortamı ayrıştırır ve sondaki eğik çizgiyi atar", () =>
    expect(parseEnv(ok)).toEqual({
      CORE_API_URL: "http://core:3000",
      SALES_API_SECRET: "s".repeat(32),
      SITE_URL: "http://localhost:3370",
      TRUSTED_IP_HEADER: undefined,
    }));
  it("31 karakterlik sır reddedilir", () =>
    expect(() => parseEnv({ ...ok, SALES_API_SECRET: "s".repeat(31) })).toThrow(/SALES_API_SECRET/));
  it("üretimde http SITE_URL reddedilir", () =>
    expect(() => parseEnv({ ...ok, NODE_ENV: "production", TRUSTED_IP_HEADER: "x-real-ip" })).toThrow(/SITE_URL/));
  it("üretimde TRUSTED_IP_HEADER zorunludur", () =>
    expect(() => parseEnv({ ...ok, NODE_ENV: "production", SITE_URL: "https://bilet.example" })).toThrow(
      /TRUSTED_IP_HEADER/,
    ));
  it("başlık adı küçük harfe çevrilir", () =>
    expect(parseEnv({ ...ok, TRUSTED_IP_HEADER: "X-Real-IP" }).TRUSTED_IP_HEADER).toBe("x-real-ip"));
  it("sır NEXT_PUBLIC_ önekiyle verilemez", () =>
    expect(() => parseEnv({ ...ok, NEXT_PUBLIC_SALES_API_SECRET: "x" })).toThrow("Sır NEXT_PUBLIC_ önekiyle verilemez"));
  it("hata mesajı Türkçe önek taşır", () =>
    expect(() => parseEnv({ ...ok, CORE_API_URL: "ftp://x" })).toThrow(/^Geçersiz ortam değişkenleri: /));
});
