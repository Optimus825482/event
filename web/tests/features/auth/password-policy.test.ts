import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, passwordPolicyError } from "@/features/auth/password-policy";
import { MIN_PASSWORD_LENGTH as CLI_MIN } from "../../../scripts/create-admin.mjs";

describe("parola kuralı", () => {
  it("asgari uzunluk 6'dır ve komut satırı aracıyla aynıdır", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(6);
    expect(CLI_MIN).toBe(MIN_PASSWORD_LENGTH);
  });

  it("6 karakter, büyük harf, küçük harf ve rakam içeren parolayı kabul eder", () => {
    expect(passwordPolicyError("Abc123")).toBeNull();
    expect(passwordPolicyError("Şifre1")).toBeNull();
    expect(passwordPolicyError("İstanbul2026")).toBeNull();
  });

  it("kısa parolayı uzunluk mesajıyla reddeder", () => {
    expect(passwordPolicyError("Ab1")).toBe("Parola en az 6 karakter olmalı");
    expect(passwordPolicyError("Abc12")).toBe("Parola en az 6 karakter olmalı");
  });

  it.each(["abc123", "ABC123", "Abcdef", "123456", "abcdefgh", "!!!aaa111"])("eksik sınıfı reddeder: %s", (value) => {
    expect(passwordPolicyError(value)).toBe("Parola büyük harf, küçük harf ve rakam içermeli");
  });
});
