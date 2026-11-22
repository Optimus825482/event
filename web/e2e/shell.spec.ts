import { EMPTY_STATE, adminPassword, adminUsername, expect, test } from "./support/fixtures";
import { signIn, signOut } from "./support/offline";

const EXPECTED_MODULES = ["Etkinlik Planlama", "Rezervasyon", "Check-in", "Sistem Yönetimi"];

test.describe("Uygulama kabuğu", () => {
  test.use({ storageState: EMPTY_STATE });

  test("giriş → modül kartları → her modülün menü sayfaları hatasız açılır → Profilim → çıkış", async ({ page }) => {
    // Fikstür yakalanmamış hataları ve CSP ihlallerini zaten toplar; burada konsol hataları da başarısızlık sayılır.
    const consoleErrors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(`${page.url()} :: ${m.text()}`);
    });
    page.on("pageerror", (e) => consoleErrors.push(`${page.url()} :: ${e.message}`));

    await signIn(page, adminUsername, adminPassword());
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Modül Seçin", level: 1 })).toBeVisible();
    const cards = page.getByRole("list").getByRole("link");
    for (const name of EXPECTED_MODULES) {
      await expect(cards.filter({ has: page.getByRole("heading", { name, exact: true, level: 2 }) })).toBeVisible();
    }
    const modules = await cards.evaluateAll((links) =>
      links.map((a) => ({ name: a.querySelector("h2")?.textContent ?? "", href: a.getAttribute("href") ?? "" })),
    );
    expect(modules.length).toBeGreaterThanOrEqual(EXPECTED_MODULES.length);

    const visited = new Set<string>();
    for (const card of modules) {
      await page.goto("/");
      await page.getByRole("link").filter({ has: page.getByRole("heading", { name: card.name, exact: true, level: 2 }) }).click();
      await page.waitForURL((url) => url.pathname === card.href);
      const nav = page.getByRole("navigation", { name: "Ana menü" });
      await expect(nav).toBeVisible();
      const hrefs = await nav.getByRole("link").evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
      expect(hrefs.length, `${card.name} menüsü boş`).toBeGreaterThan(0);

      for (const href of hrefs) {
        if (visited.has(href)) continue;
        visited.add(href);
        const response = await page.goto(href);
        expect(response?.status(), `${href} yanıt kodu`).toBeLessThan(400);
        await expect(page.getByRole("heading", { level: 1 }).first(), `${href} başlığı`).toBeVisible();
        await expect(page.getByRole("heading", { name: "Bir şeyler ters gitti" })).toHaveCount(0);
        await expect(page.getByRole("heading", { name: "Sayfa bulunamadı" })).toHaveCount(0);
        await expect(page.getByRole("heading", { name: "Bu sayfaya erişim yetkiniz yok" })).toHaveCount(0);
        // Etkin menü öğesi bu sayfayı gösterir.
        await expect(page.getByRole("navigation", { name: "Ana menü" }).locator(`a[href="${href}"]`)).toHaveAttribute("aria-current", "page");
      }
    }

    await page.getByRole("button", { name: "Profil menüsü" }).click();
    await page.getByRole("menuitem", { name: "Profilim" }).click();
    await page.waitForURL(/\/profile$/);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

    await signOut(page);
    expect(consoleErrors, "konsol hataları").toEqual([]);
  });
});
