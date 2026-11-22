import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signQrToken, verifyQrToken } from "@/features/reservations/qr-token";

const b64 = (value: string) => Buffer.from(value, "utf8").toString("base64url");

describe("QR belirteci", () => {
  it("imzalanan belirteç doğrulanır ve rezervasyon kimliğini döndürür", () => {
    const id = randomUUID();
    const token = signQrToken(id);
    expect(verifyQrToken(token)).toEqual({ reservationId: id });
  });

  it("biçim base64url(kimlik).base64url(HMAC) şeklindedir ve masa bilgisi taşımaz", () => {
    const id = randomUUID();
    const token = signQrToken(id);
    const [head, mac, extra] = token.split(".");
    expect(extra).toBeUndefined();
    expect(head).toBe(b64(id));
    expect(Buffer.from(mac ?? "", "base64url").length).toBe(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it("aynı kimlik için belirleyicidir, farklı kimlikler farklı imza üretir", () => {
    const id = randomUUID();
    expect(signQrToken(id)).toBe(signQrToken(id));
    expect(signQrToken(id).split(".")[1]).not.toBe(signQrToken(randomUUID()).split(".")[1]);
  });

  it("başka anahtarla imzalanmış belirteç reddedilir", () => {
    const id = randomUUID();
    const foreign = signQrToken(id, Buffer.from("x".repeat(32)));
    expect(verifyQrToken(foreign)).toBeNull();
    expect(verifyQrToken(foreign, Buffer.from("x".repeat(32)))).toEqual({ reservationId: id });
  });

  it("kimliği değiştirilmiş belirteç reddedilir", () => {
    const [, mac] = signQrToken(randomUUID()).split(".");
    expect(verifyQrToken(`${b64(randomUUID())}.${mac}`)).toBeNull();
  });

  it("bozuk biçimler null döner", () => {
    const valid = signQrToken(randomUUID());
    const [head, mac] = valid.split(".");
    const cases = [
      "",
      ".",
      "abc",
      `${head}.`,
      `.${mac}`,
      `${head}.${mac}.x`,
      `${head}.${mac?.slice(0, -2)}`,
      `${head}!.${mac}`,
      `${b64("not-a-uuid")}.${mac}`,
      "a".repeat(5000),
    ];
    for (const token of cases) expect(verifyQrToken(token), token).toBeNull();
  });

  it("geçerli uuid olmayan kimlik imzalanamaz", () => {
    expect(() => signQrToken("not-a-uuid")).toThrow();
  });
});
