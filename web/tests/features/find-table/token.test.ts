import { describe, expect, it } from "vitest";
import { signInvitationToken } from "@/features/invitations/token";
import { signFindTableToken, verifyFindTableToken } from "@/features/find-table/token";
import { signQrToken } from "@/features/reservations/qr-token";

const ID = "11111111-1111-4111-8111-111111111111";

describe("masamı bul belirteci", () => {
  it("imzala → doğrula", () => {
    expect(verifyFindTableToken(signFindTableToken("order", ID))).toEqual({ kind: "order", id: ID });
    expect(verifyFindTableToken(signFindTableToken("reservation", ID))).toEqual({ kind: "reservation", id: ID });
  });

  it("tür imzaya dahildir: sipariş belirteci rezervasyon olarak okunamaz", () => {
    const [, mac] = signFindTableToken("order", ID).split(".");
    expect(verifyFindTableToken(`${Buffer.from(`r:${ID}`).toString("base64url")}.${mac}`)).toBeNull();
  });

  it.each(["", "a", "a.b", "a.b.c", "x".repeat(201)])("bozuk girdi %s null", (t) => {
    expect(verifyFindTableToken(t)).toBeNull();
  });

  it("uuid olmayan kimlik imzalı olsa bile reddedilir", () => {
    expect(verifyFindTableToken(signFindTableToken("order", "not-a-uuid"))).toBeNull();
  });

  it("başka anahtarla imzalanmış belirteçler kabul edilmez", () => {
    expect(verifyFindTableToken(signQrToken(ID))).toBeNull();
    expect(verifyFindTableToken(signInvitationToken(ID, ID))).toBeNull();
  });
});
