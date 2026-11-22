import { expect, test, adminPassword, adminUsername, loginAs, EMPTY_STATE } from "./support/fixtures";

test.describe("Giriş ve oturum", () => {
  test.use({ storageState: EMPTY_STATE });

  test("giriş yapmamış kullanıcı korumalı sayfadan /login'e yönlenir", async ({ page }) => {
    await page.goto("/events");
    await expect(page).toHaveURL(/\/login\?next=%2Fevents/);
    await expect(page.getByRole("button", { name: "Giriş yap" })).toBeVisible();
  });

  test("sayfa yanıtı nonce'lu CSP başlığı taşır ve gövdedeki betikler aynı nonce'u kullanır", async ({ page }) => {
    const response = await page.goto("/login");
    const csp = response?.headers()["content-security-policy"] ?? "";
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1] ?? "";
    expect(nonce.length).toBeGreaterThanOrEqual(22);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    // Tarayıcı nonce'u öznitelikten gizler; özellik (property) üzerinden okunur. (Nonce'suz olanlar CSP dışı veri betikleri/sonradan eklenenlerdir.)
    const scriptNonces = await page.evaluate(() => [...document.scripts].filter((s) => s.src === "" && s.nonce !== "").map((s) => s.nonce));
    expect(scriptNonces.length).toBeGreaterThan(0);
    expect(new Set(scriptNonces)).toEqual(new Set([nonce]));
  });

  test("hız sınırı (429) parola hatası gibi değil, bekleme süresiyle ayrı mesajla gösterilir", async ({ page }) => {
    await page.route("**/api/auth/sign-in/username", (route) =>
      route.fulfill({
        status: 429,
        headers: { "content-type": "application/json", "x-retry-after": "8" },
        body: JSON.stringify({ message: "Too many requests. Please try again later." }),
      }),
    );
    await loginAs(page, adminUsername, "herhangi-bir-parola");
    const alert = page.getByRole("alert").filter({ hasText: "Çok fazla deneme yapıldı" });
    await expect(alert).toContainText("8 saniye");
    await expect(page.getByText("Kullanıcı adı veya parola hatalı")).toHaveCount(0);
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
