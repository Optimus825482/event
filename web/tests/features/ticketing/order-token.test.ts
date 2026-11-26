import { describe, expect, it } from "vitest";
import { signQrToken, verifyQrToken } from "@/features/reservations/qr-token";
import { signOrderToken, verifyOrderToken } from "@/features/ticketing/order-token";

const ID = "3f2b8c1e-4d5a-4e6f-8a9b-0c1d2e3f4a5b";
const OTHER = "9a8b7c6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";

describe("order-token", () => {
  it("imzala-doğrula gidiş dönüşü", () => expect(verifyOrderToken(signOrderToken(ID))).toEqual({ orderId: ID }));
  it("imzanın tek karakteri değişirse reddedilir", () => {
    const t = signOrderToken(ID);
    const last = t.slice(-1);
    const tampered = t.slice(0, -1) + (last === "A" ? "B" : "A");
    expect(verifyOrderToken(tampered)).toBeNull();
  });
  it("başka kimliğin imzasıyla birleştirilen belirteç reddedilir", () => {
    const head = signOrderToken(ID).split(".")[0];
    const sig = signOrderToken(OTHER).split(".")[1];
    expect(verifyOrderToken(`${head}.${sig}`)).toBeNull();
  });
  it("başka sırla imzalanan belirteç reddedilir", () =>
    expect(verifyOrderToken(signOrderToken(ID, "x".repeat(32)), "y".repeat(32))).toBeNull());
  it("QR belirteci sipariş belirteci yerine geçmez; tersi de", () => {
    expect(verifyOrderToken(signQrToken(ID))).toBeNull();
    expect(verifyQrToken(signOrderToken(ID))).toBeNull();
  });
  it.each(["", "abc", "a.b.c", `${"A".repeat(300)}.x`, "bm90LXV1aWQ.AAAA"])("bozuk belirteç %j → null", (t) =>
    expect(verifyOrderToken(t)).toBeNull());
  it("uuid olmayan kimlik imzalanmaz", () => expect(() => signOrderToken("123")).toThrow());
});
