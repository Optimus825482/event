import { randomBytes } from "node:crypto";
import { createManager, openSession } from "./support/departments";
import { expect, test } from "./support/fixtures";
import { clearDemo, demoEventCount, salesDemoFlag } from "./support/ss-p5";
import { DEMO_CONCERTS } from "../src/features/demo/concerts";

const ENT_PASS = `Ent1-${randomBytes(12).toString("base64url")}`;

test.describe("Satış sitesi demo modu", () => {
  test.describe.configure({ mode: "serial" });

  test.afterAll(async () => {
    await clearDemo();
  });

  test("yönetici demo modunu açar: on demo etkinlik tohumlanır ve rozetle listelenir", async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto("/dashboard");
    const totalCard = page.getByText("Toplam Etkinlik").locator("..");
    await expect(totalCard).toBeVisible();
    const beforeText = await totalCard.textContent();

    await page.goto("/admin/settings");
    await page.getByRole("tab", { name: "Satış sitesi" }).click();
    await page.getByRole("switch", { name: "Satış sitesi demo aktif" }).click();

    await expect(page.getByText("Demo modu açıldı")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(`${DEMO_CONCERTS.length} demo etkinlik · 0 sipariş`)).toBeVisible();
    expect(await demoEventCount()).toBe(DEMO_CONCERTS.length);
    expect(await salesDemoFlag()).toBe(true);

    await page.goto("/events");
    const row = page.locator("li").filter({ hasText: "Levent Yüksel · Aralık Galası" });
    await expect(row).toBeVisible();
    await expect(row.getByText("DEMO", { exact: true })).toBeVisible();

    await page.goto("/dashboard");
    await expect(totalCard).toHaveText(beforeText ?? "");
  });

  test("kapatmak veriyi silmez", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.getByRole("tab", { name: "Satış sitesi" }).click();
    await page.getByRole("switch", { name: "Satış sitesi demo aktif" }).click();

    await expect(page.getByText("Demo modu kapatıldı")).toBeVisible();
    expect(await demoEventCount()).toBe(DEMO_CONCERTS.length);
    expect(await salesDemoFlag()).toBe(false);
  });

  test("demo verilerini sil onay ister ve kalıcı siler", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.getByRole("tab", { name: "Satış sitesi" }).click();

    await page.getByRole("button", { name: "Demo verilerini sil" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Bu işlem geri alınamaz");
    await dialog.getByRole("button", { name: "Vazgeç" }).click();
    expect(await demoEventCount()).toBe(DEMO_CONCERTS.length);

    await page.getByRole("button", { name: "Demo verilerini sil" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Sil" }).click();
    await expect(page.getByText("Demo verileri silindi")).toBeVisible();
    expect(await demoEventCount()).toBe(0);
    expect(await salesDemoFlag()).toBe(false);

    await page.goto("/events");
    await expect(page.getByText("DEMO", { exact: true })).toHaveCount(0);
  });

  test("Entertainment yöneticisi demo bölümünü göremez", async ({ page, browser }) => {
    const dept = {
      username: `e2e-ent-demo-${Date.now()}`,
      fullName: "Entertainment Yöneticisi",
      label: "Entertainment",
    };
    await createManager(page, dept, ENT_PASS);

    const { context, page: entPage } = await openSession(browser, dept, ENT_PASS);
    try {
      await entPage.goto("/admin/settings");
      await expect(entPage.getByRole("tab", { name: "Satış sitesi" })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
