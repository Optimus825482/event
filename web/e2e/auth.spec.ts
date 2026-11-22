import { expect, test, adminPassword, adminUsername, loginAs, EMPTY_STATE } from "./support/fixtures";

test.describe("Giriş ve oturum", () => {
  test.use({ storageState: EMPTY_STATE });

  test("giriş yapmamış kullanıcı korumalı sayfadan /login'e yönlenir", async ({ page }) => {
    await page.goto("/events");
    await expect(page).toHaveURL(/\/login\?next=%2Fevents/);
    await expect(page.getByRole("button", { name: "Giriş yap" })).toBeVisible();
  });

  test("yanlış parola hata gösterir, doğru parola uygulamaya alır, çıkış çalışır", async ({ page }) => {
    await loginAs(page, adminUsername, "yanlis-parola-123456");
    await expect(page.getByRole("alert").filter({ hasText: "Kullanıcı adı veya parola hatalı" })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    await loginAs(page, adminUsername, adminPassword());
    await expect(page.getByRole("button", { name: "Çıkış yap" })).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("navigation", { name: "Ana menü" }).getByRole("link", { name: "Etkinlikler" })).toBeVisible();

    await page.getByRole("button", { name: "Çıkış yap" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/events");
    await expect(page).toHaveURL(/\/login/);
  });
});
