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
    const badJson = Buffer.from(JSON.stringify({ qrCodeHash: "kisa" })).toString("base64");
    expect(parseScannedCode(badJson)).toEqual({ token: badJson });
  });
});
