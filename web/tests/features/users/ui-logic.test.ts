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
    expect(passwordChangeError(400, { code: "INVALID_PASSWORD" }, null)).toEqual({
      field: "current",
      message: "Mevcut parola hatalı",
    });
  });
  it("hız sınırında bekleme süresini söyler", () => {
    expect(passwordChangeError(429, null, "30").message).toContain("30 saniye");
  });
  it("bilinmeyen hatada genel mesaj verir", () => {
    expect(passwordChangeError(500, null, null).field).toBeNull();
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
