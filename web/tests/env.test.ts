import { hkdfSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseEnv, qrSigningKey } from "@/env";

const valid = {
  DATABASE_URL: "postgres://postgres@localhost:54329/eventflow_test",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  UPLOAD_DIR: "./uploads",
  NODE_ENV: "test",
};

describe("parseEnv", () => {
  it("geçerli girdiyi kabul eder", () => {
    const parsed = parseEnv(valid);
    expect(parsed.DATABASE_URL).toBe(valid.DATABASE_URL);
    expect(parsed.NODE_ENV).toBe("test");
  });

  it("31 karakterlik BETTER_AUTH_SECRET reddedilir", () => {
    expect(() => parseEnv({ ...valid, BETTER_AUTH_SECRET: "a".repeat(31) })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });

  it("üretimde BETTER_AUTH_URL yoksa değişken adıyla hata verir", () => {
    const { BETTER_AUTH_URL: _omitted, ...rest } = valid;
    void _omitted;
    expect(() => parseEnv({ ...rest, NODE_ENV: "production" })).toThrow(/BETTER_AUTH_URL/);
  });

  it("üretimde http:// ile başlayan BETTER_AUTH_URL reddedilir", () => {
    expect(() =>
      parseEnv({ ...valid, NODE_ENV: "production", BETTER_AUTH_URL: "http://eventflow.example.com" }),
    ).toThrow(/BETTER_AUTH_URL/);
  });

  it("üretimde https:// ile başlayan BETTER_AUTH_URL kabul edilir", () => {
    const parsed = parseEnv({
      ...valid,
      NODE_ENV: "production",
      BETTER_AUTH_URL: "https://eventflow.example.com",
      TRUSTED_IP_HEADER: "x-real-ip",
    });
    expect(parsed.BETTER_AUTH_URL).toBe("https://eventflow.example.com");
  });

  it("geliştirmede BETTER_AUTH_URL yoksa varsayılan kullanılır", () => {
    const { BETTER_AUTH_URL: _omitted, ...rest } = valid;
    void _omitted;
    expect(parseEnv({ ...rest, NODE_ENV: "development" }).BETTER_AUTH_URL).toBe("http://localhost:3000");
  });

  it("TRUSTED_IP_HEADER isteğe bağlıdır; boşsa tanımsız sayılır, değer küçük harfe çevrilir", () => {
    expect(parseEnv(valid).TRUSTED_IP_HEADER).toBeUndefined();
    expect(parseEnv({ ...valid, TRUSTED_IP_HEADER: "" }).TRUSTED_IP_HEADER).toBeUndefined();
    expect(parseEnv({ ...valid, TRUSTED_IP_HEADER: " X-Forwarded-For " }).TRUSTED_IP_HEADER).toBe(
      "x-forwarded-for",
    );
  });

  describe("üretimde TRUSTED_IP_HEADER", () => {
    const production = { ...valid, NODE_ENV: "production", BETTER_AUTH_URL: "https://eventflow.example.com" };

    it("yoksa değişken adını ve Traefik değerini içeren hata verir", () => {
      expect(() => parseEnv(production)).toThrow(/TRUSTED_IP_HEADER.*x-real-ip/);
    });

    it("tanımlıysa kabul edilir", () => {
      expect(parseEnv({ ...production, TRUSTED_IP_HEADER: "X-Real-IP" }).TRUSTED_IP_HEADER).toBe("x-real-ip");
    });

    it("yalnızca boşluktan oluşuyorsa tanımsız sayılır ve reddedilir", () => {
      expect(() => parseEnv({ ...production, TRUSTED_IP_HEADER: "  " })).toThrow(/TRUSTED_IP_HEADER/);
    });

    it("geliştirmede zorunlu değildir", () => {
      expect(parseEnv({ ...valid, NODE_ENV: "development" }).TRUSTED_IP_HEADER).toBeUndefined();
    });

    it("phase-production-build sırasında zorunlu değildir", () => {
      expect(parseEnv({ ...production, NEXT_PHASE: "phase-production-build" }).TRUSTED_IP_HEADER).toBeUndefined();
    });
  });

  describe("QR_SIGNING_KEY", () => {
    it("isteğe bağlıdır; tanımsız ya da boşsa tanımsız sayılır", () => {
      expect(parseEnv(valid).QR_SIGNING_KEY).toBeUndefined();
      expect(parseEnv({ ...valid, QR_SIGNING_KEY: "  " }).QR_SIGNING_KEY).toBeUndefined();
    });

    it("31 karakter reddedilir, 32 karakter kabul edilir", () => {
      expect(() => parseEnv({ ...valid, QR_SIGNING_KEY: "k".repeat(31) })).toThrow(/QR_SIGNING_KEY/);
      expect(parseEnv({ ...valid, QR_SIGNING_KEY: "k".repeat(32) }).QR_SIGNING_KEY).toBe("k".repeat(32));
    });

    it("tanımlıysa anahtar olarak doğrudan kullanılır", () => {
      const key = qrSigningKey(parseEnv({ ...valid, QR_SIGNING_KEY: "k".repeat(40) }));
      expect(key.equals(Buffer.from("k".repeat(40), "utf8"))).toBe(true);
    });

    it("tanımsızsa BETTER_AUTH_SECRET'tan HKDF-SHA256 ('qr-token-v1') ile türetilir", () => {
      const key = qrSigningKey(parseEnv(valid));
      const expected = Buffer.from(hkdfSync("sha256", valid.BETTER_AUTH_SECRET, "", "qr-token-v1", 32));
      expect(key.length).toBe(32);
      expect(key.equals(expected)).toBe(true);
      expect(key.equals(Buffer.from(valid.BETTER_AUTH_SECRET, "utf8"))).toBe(false);
    });

    it("türetilen anahtar sırra bağlıdır", () => {
      const a = qrSigningKey(parseEnv(valid));
      const b = qrSigningKey(parseEnv({ ...valid, BETTER_AUTH_SECRET: "b".repeat(32) }));
      expect(a.equals(b)).toBe(false);
    });
  });

  it("DATABASE_URL eksikse hata mesajı değişken adını içerir", () => {
    const { DATABASE_URL: _omitted, ...rest } = valid;
    void _omitted;
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });
});
