import { randomBytes } from "node:crypto";

import { expect, test, EMPTY_STATE, loginAs } from "./support/fixtures";

const USERNAME = "e2e-kapi";
// Kısıtlı kullanıcının parolası her koşuda rastgele üretilir; yalnızca bellekte yaşar.
const PASSWORD = `Kp-${randomBytes(12).toString("base64url")}`;

test.describe("Yetkiler", () => {
  test.describe.configure({ mode: "serial" });

  test("kısıtlı rollü kullanıcı yönetici sayfalarını menüde görmez ve doğrudan gidemez", async ({ page, browser }) => {
    // Yönetici arayüzünden check-in yetkili bir "Kapı kontrolörü" oluşturulur.
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Kullanıcılar", level: 1 })).toBeVisible();
    await page.getByLabel("Kullanıcı adı", { exact: true }).fill(USERNAME);
    await page.getByLabel("Ad soyad").fill("Kapı Görevlisi");
    await page.getByLabel("Rol", { exact: true }).selectOption({ label: "Kontrolör" });
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

      // Sunucu yetkiyi uygular: etkinlik içeriği hiç gösterilmez (hata biçimi için aşağıdaki fixme'ye bakın).
      await restricted.goto("/events");
      await expect(restricted.getByRole("heading", { name: "Etkinlikler", level: 1 })).toHaveCount(0);
      await expect(restricted.getByRole("link", { name: "Yeni etkinlik" })).toHaveCount(0);
      await expect(restricted.getByRole("heading", { name: "Bir şeyler ters gitti" })).toBeVisible();

      // İzinli sayfa açılır.
      await restricted.goto("/check-in");
      await expect(restricted.getByRole("heading", { name: "Check-in", level: 1 })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  // UYGULAMA HATASI (bkz. rapor, "ForbiddenError sayfalarda yakalanmıyor"): yetkisiz kullanıcı /events'e
  // gidince `loadEventList` ForbiddenError fırlatır ve kullanıcı anlamsız "Bir şeyler ters gitti" (genel
  // hata sınırı, sunucu günlüğünde yığın izi) görür; "yetkiniz yok" ya da 404 beklenir.
  test.fixme("yetkisiz sayfa genel hata yerine anlaşılır bir reddetme gösterir", async ({ browser }) => {
    const context = await browser.newContext({ storageState: EMPTY_STATE });
    const restricted = await context.newPage();
    try {
      await loginAs(restricted, USERNAME, PASSWORD);
      await restricted.goto("/events");
      await expect(restricted.getByRole("heading", { name: "Bir şeyler ters gitti" })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
