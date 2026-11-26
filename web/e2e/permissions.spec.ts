import { randomBytes } from "node:crypto";

import { expect, test, EMPTY_STATE, loginAs } from "./support/fixtures";

const USERNAME = "e2e-kapi";
// Kısıtlı kullanıcının parolası her koşuda rastgele üretilir; yalnızca bellekte yaşar.
const PASSWORD = `Kp1-${randomBytes(12).toString("base64url")}`;

test.describe("Yetkiler", () => {
  test.describe.configure({ mode: "serial" });

  test("kısıtlı rollü kullanıcı yönetici sayfalarını menüde görmez ve doğrudan gidemez", async ({ page, browser }) => {
    // Yönetici arayüzünden yalnızca check-in izni olan bir kapı görevlisi oluşturulur.
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Kullanıcılar", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Yeni kullanıcı" }).click();
    await page.getByLabel("Kullanıcı adı", { exact: true }).fill(USERNAME);
    await page.getByLabel("Ad soyad").fill("Kapı Görevlisi");
    // Yalnızca check-in izni olan Casino kullanıcısı.
    await page.getByLabel("Rol", { exact: true }).selectOption({ label: "Departman kullanıcısı" });
    await page.getByLabel("Casino", { exact: true }).check();
    await page.getByLabel("Check-in: Görüntüle", { exact: true }).check();
    await page.getByLabel("Check-in: Oluştur", { exact: true }).check();
    await page.getByLabel("Parola", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Kullanıcı oluştur" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Kullanıcı oluşturuldu" })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: USERNAME })).toBeVisible();

    const context = await browser.newContext({ storageState: EMPTY_STATE });
    const restricted = await context.newPage();
    try {
      await loginAs(restricted, USERNAME, PASSWORD);
      const nav = restricted.getByRole("navigation", { name: "Ana menü" });
      await expect(nav).toBeVisible();

      // Yalnızca check-in menüde.
      await expect(nav.getByRole("link", { name: "Check-in" })).toBeVisible();
      for (const hidden of ["Etkinlikler", "Rezervasyonlar", "Müşteriler", "Personel", "Kullanıcılar", "Ayarlar", "Masa Tipleri"]) {
        await expect(nav.getByRole("link", { name: hidden, exact: true })).toHaveCount(0);
      }

      // Doğrudan gezinme reddedilir: yönetim sayfası içerik göstermez.
      await restricted.goto("/admin/users");
      await expect(restricted.getByRole("heading", { name: "Kullanıcılar", level: 1 })).toHaveCount(0);
      await expect(restricted.getByRole("button", { name: "Kullanıcı oluştur" })).toHaveCount(0);
      await expect(restricted.getByRole("heading", { name: "Sayfa bulunamadı" })).toBeVisible();

      // Sunucu yetkiyi uygular: etkinlik içeriği hiç gösterilmez, anlaşılır bir reddetme sayfası çıkar.
      await restricted.goto("/events");
      await expect(restricted.getByRole("heading", { name: "Etkinlikler", level: 1 })).toHaveCount(0);
      await expect(restricted.getByRole("link", { name: "Yeni etkinlik" })).toHaveCount(0);
      await expect(restricted.getByRole("heading", { name: "Bu sayfaya erişim yetkiniz yok", level: 1 })).toBeVisible();
      await expect(restricted.getByRole("heading", { name: "Bir şeyler ters gitti" })).toHaveCount(0);
      // Menü ve oturum çalışmaya devam eder (yalnızca sayfa içeriği değişir).
      await expect(nav.getByRole("link", { name: "Check-in" })).toBeVisible();

      // İzinli sayfa açılır.
      await restricted.goto("/check-in");
      await expect(restricted.getByRole("heading", { name: "Check-in", level: 1 })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  // `ForbiddenError` Next'in 403 özetini taşır: sayfa genel hata sınırına değil `(app)/forbidden.tsx`'e düşer.
  // Not: `/events` gibi `loading.tsx` olan sayfalarda akış başladığı için durum kodu 200 kalır (Next belgesi).
  test("yetkisiz sayfa genel hata yerine anlaşılır bir reddetme gösterir", async ({ browser }) => {
    const context = await browser.newContext({ storageState: EMPTY_STATE });
    const restricted = await context.newPage();
    try {
      await loginAs(restricted, USERNAME, PASSWORD);
      await expect(restricted.getByRole("navigation", { name: "Ana menü" })).toBeVisible();
      const response = await restricted.goto("/events");
      await expect(restricted.getByRole("heading", { name: "Bir şeyler ters gitti" })).toHaveCount(0);
      await expect(restricted.getByRole("alert").filter({ hasText: "Bu sayfaya erişim yetkiniz yok" })).toBeVisible();
      // Güvenlik başlıkları (next.config.ts) gerçek sunucuda uygulanır.
      expect(response?.headers()["x-frame-options"]).toBe("DENY");
      expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
      expect(response?.headers()["x-powered-by"]).toBeUndefined();
    } finally {
      await context.close();
    }
  });
});
