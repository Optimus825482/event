import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, getSettingsKey } from "@/features/settings/crypto";

const key = randomBytes(32);

describe("encryptSecret / decryptSecret", () => {
  it("gidiş dönüşte aynı metni verir", () => {
    const cipher = encryptSecret("smtp-parolası-ğüşiöç", key);
    expect(decryptSecret(cipher, key)).toBe("smtp-parolası-ğüşiöç");
  });

  it("şifreli metin düz metni içermez ve sürüm önekiyle başlar", () => {
    const cipher = encryptSecret("cok-gizli", key);
    expect(cipher.startsWith("v1:")).toBe(true);
    expect(cipher).not.toContain("cok-gizli");
  });

  it("her şifrelemede farklı IV kullanır", () => {
    expect(encryptSecret("aynı", key)).not.toBe(encryptSecret("aynı", key));
  });

  it("yanlış anahtarla çözülemez", () => {
    const cipher = encryptSecret("x", key);
    expect(() => decryptSecret(cipher, randomBytes(32))).toThrow();
  });

  it("değiştirilmiş şifreli metin reddedilir (kimlik doğrulama etiketi)", () => {
    const parts = encryptSecret("bütünlük", key).split(":");
    const data = Buffer.from(parts[3] ?? "", "base64");
    data[0] = (data[0] ?? 0) ^ 1;
    parts[3] = data.toString("base64");
    expect(() => decryptSecret(parts.join(":"), key)).toThrow();
  });

  it("bilinmeyen sürüm ve bozuk biçim reddedilir", () => {
    expect(() => decryptSecret("v9:a:b:c", key)).toThrow();
    expect(() => decryptSecret("rastgele", key)).toThrow();
  });

  it("32 bayt olmayan anahtarı reddeder", () => {
    expect(() => encryptSecret("x", randomBytes(16))).toThrow();
  });
});

describe("getSettingsKey", () => {
  const original = process.env.SETTINGS_ENCRYPTION_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.SETTINGS_ENCRYPTION_KEY;
    else process.env.SETTINGS_ENCRYPTION_KEY = original;
  });

  it("geçerli base64 anahtarı 32 baytlık Buffer olarak döner", () => {
    process.env.SETTINGS_ENCRYPTION_KEY = key.toString("base64");
    expect(getSettingsKey().equals(key)).toBe(true);
  });

  it("eksik anahtarda açık bir hata verir", () => {
    delete process.env.SETTINGS_ENCRYPTION_KEY;
    expect(() => getSettingsKey()).toThrow(/SETTINGS_ENCRYPTION_KEY/);
  });

  it("32 bayt olmayan anahtarda hata verir", () => {
    process.env.SETTINGS_ENCRYPTION_KEY = randomBytes(8).toString("base64");
    expect(() => getSettingsKey()).toThrow(/SETTINGS_ENCRYPTION_KEY/);
  });
});
