import { describe, expect, it } from "vitest";
import { GENERIC_LOGIN_ERROR, loginErrorMessage, parseRetryAfter } from "@/features/auth/login-error";

describe("parseRetryAfter", () => {
  it.each([
    ["7", 7],
    [" 12 ", 12],
    ["0", null],
    ["-3", null],
    ["abc", null],
    ["", null],
    [null, null],
    ["3.5", null],
    ["99999999", null],
  ])("%j -> %j", (raw, expected) => {
    expect(parseRetryAfter(raw)).toBe(expected);
  });
});

describe("loginErrorMessage", () => {
  it("429 parola hatası olarak gösterilmez", () => {
    const text = loginErrorMessage(429, null);
    expect(text).toBe("Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.");
    expect(text).not.toBe(GENERIC_LOGIN_ERROR);
  });

  it("bekleme süresi varsa saniye olarak eklenir", () => {
    expect(loginErrorMessage(429, "8")).toBe("Çok fazla deneme yapıldı. Lütfen 8 saniye sonra tekrar deneyin.");
  });

  it("60 saniye ve üstü dakikaya yuvarlanır (yukarı)", () => {
    expect(loginErrorMessage(429, "60")).toBe("Çok fazla deneme yapıldı. Lütfen 1 dakika sonra tekrar deneyin.");
    expect(loginErrorMessage(429, "61")).toBe("Çok fazla deneme yapıldı. Lütfen 2 dakika sonra tekrar deneyin.");
  });

  it.each([401, 400, 403, 500])("%i genel hata mesajıdır", (status) => {
    expect(loginErrorMessage(status, "5")).toBe(GENERIC_LOGIN_ERROR);
  });
});
