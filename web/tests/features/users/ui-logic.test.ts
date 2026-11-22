import { describe, expect, it } from "vitest";
import { countUsers, filterUsers } from "@/features/users/filter";
import { passwordChangeError, validatePasswordChange } from "@/features/users/password-change";
import type { UserSummary } from "@/features/users/types";

const base: UserSummary = {
  id: "1",
  username: "ayse",
  name: "Ayşe Yılmaz",
  email: "ayse@example.com",
  role: "staff",
  isActive: true,
  staffId: null,
  color: null,
  phone: "0555",
  position: "Şef",
  createdAt: new Date(0),
};
const users: UserSummary[] = [
  base,
  { ...base, id: "2", username: "admin1", name: "Yönetici", role: "admin", isActive: false, phone: null, position: null },
];

describe("validatePasswordChange", () => {
  it("geçerli girdide hata yok", () => {
    expect(validatePasswordChange({ current: "eski-parola-1", next: "yeni-parola-123", confirm: "yeni-parola-123" })).toEqual({});
  });
  it("kısa, eşleşmeyen ve boş alanları yakalar", () => {
    const errors = validatePasswordChange({ current: "", next: "kisa", confirm: "farkli" });
    expect(Object.keys(errors).sort()).toEqual(["confirm", "current", "next"]);
  });
  it("aynı parolayı reddeder", () => {
    const same = "aynı-parola-123";
    expect(validatePasswordChange({ current: same, next: same, confirm: same }).next).toMatch(/aynı/);
  });
});

describe("passwordChangeError", () => {
  it("yanlış mevcut parolayı alana bağlar", () => {
    expect(passwordChangeError({ code: "invalid", message: "Mevcut parola hatalı" })).toEqual({
      field: "current",
      message: "Mevcut parola hatalı",
    });
  });
  it("alan hatasını ilgili alana bağlar", () => {
    const failure = { code: "invalid", message: "Girdi geçersiz", fieldErrors: { newPassword: ["Parola çok uzun"] } };
    expect(passwordChangeError(failure)).toEqual({ field: "next", message: "Parola çok uzun" });
  });
  it("hız sınırı mesajını olduğu gibi gösterir", () => {
    const message = "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.";
    expect(passwordChangeError({ code: "invalid", message })).toEqual({ field: null, message });
  });
  it("bilinmeyen hatada genel mesaj verir", () => {
    expect(passwordChangeError({ code: "error", message: "x" }).field).toBeNull();
  });
});

describe("filterUsers / countUsers", () => {
  it("arama Türkçe büyük/küçük harfe duyarsızdır", () => {
    expect(filterUsers(users, { search: "AYŞE", role: "all", status: "all" })).toHaveLength(1);
    expect(filterUsers(users, { search: "şef", role: "all", status: "all" })).toHaveLength(1);
  });
  it("rol ve durum süzer", () => {
    expect(filterUsers(users, { search: "", role: "admin", status: "all" }).map((u) => u.id)).toEqual(["2"]);
    expect(filterUsers(users, { search: "", role: "all", status: "active" }).map((u) => u.id)).toEqual(["1"]);
  });
  it("sayaçlar", () => {
    expect(countUsers(users)).toEqual({ total: 2, active: 1, inactive: 1, admins: 1 });
  });
});
