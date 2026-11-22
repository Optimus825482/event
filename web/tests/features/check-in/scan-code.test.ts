import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseScannedCode } from "@/features/check-in/scan-code";
import { signQrToken } from "@/features/reservations/qr-token";

describe("parseScannedCode", () => {
  it("imzalı belirteci olduğu gibi döndürür (boşluklar kırpılır)", () => {
    const token = signQrToken(randomUUID());
    expect(parseScannedCode(`  ${token}\n`)).toEqual({ token });
  });

  it("eski QR: doğrudan 32 karakterlik hash ya da base64 JSON içindeki qrCodeHash", () => {
    const hash = "0123456789abcdef0123456789ABCDEF";
    expect(parseScannedCode(hash)).toEqual({ legacyHash: hash });
    const legacy = Buffer.from(JSON.stringify({ eventId: "e", tableId: "t", qrCodeHash: hash })).toString("base64");
    expect(parseScannedCode(legacy)).toEqual({ legacyHash: hash });
  });

  it("boş ve aşırı uzun içerik null; tanınmayan içerik belirteç olarak gönderilir", () => {
    expect(parseScannedCode("   ")).toBeNull();
    expect(parseScannedCode("x".repeat(2001))).toBeNull();
    expect(parseScannedCode("rastgele metin")).toEqual({
      token: "rastgele metin",
    });
    const badJson = Buffer.from(JSON.stringify({ qrCodeHash: "geçersiz karakter!" })).toString("base64");
    expect(parseScannedCode(badJson)).toEqual({ token: badJson });
  });

  it("I1: Excel ile içe aktarılan eski rezervasyonun uzun, hex olmayan hash'i (~240 karakterlik yük) kabul edilir", () => {
    const eventId = randomUUID();
    const tableId = randomUUID();
    const hash = `${eventId}-${tableId}-${Date.now()}-k3x9a1b2c`;
    expect(hash.length).toBeGreaterThan(80);
    const payload = Buffer.from(JSON.stringify({ eventId, tableId, qrCodeHash: hash })).toString("base64");
    expect(payload.length).toBeGreaterThan(200);
    expect(payload.length).toBeLessThan(300);
    expect(parseScannedCode(payload)).toEqual({ legacyHash: hash });
  });

  it("I1: gömülü hash'in üst sınırı 128 ve karakter kümesi kısıtlıdır", () => {
    const encode = (qrCodeHash: unknown) => Buffer.from(JSON.stringify({ qrCodeHash })).toString("base64");
    const atLimit = "a".repeat(128);
    expect(parseScannedCode(encode(atLimit))).toEqual({ legacyHash: atLimit });
    const tooLong = "a".repeat(129);
    expect(parseScannedCode(encode(tooLong))).toEqual({ token: encode(tooLong) });
    expect(parseScannedCode(encode(""))).toEqual({ token: encode("") });
    expect(parseScannedCode(encode(123))).toEqual({ token: encode(123) });
    for (const bad of ["a b", "a/b", "a'b", "a;b", "<x>"]) {
      expect(parseScannedCode(encode(bad))).toEqual({ token: encode(bad) });
    }
  });
});
