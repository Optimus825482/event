import { expect, test } from "@playwright/test";
import { fakeState, holdAs, resetOrders, tableId } from "./support/fake";
import { expectNoHorizontalOverflow } from "./support/layout";

const { gala } = fakeState().events;

test.beforeEach(async () => {
  await resetOrders();
});

test("masa ve adet seçilir, tek sandalye bırakan adet sunulmaz, tutma ödeme sayfasına götürür", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}`);
  await page.getByRole("button", { name: /Masa A1,/ }).click();
  const panel = page.getByRole("region", { name: "Seçiminiz" });
  await expect(panel.getByText("Boş sandalye 8/8")).toBeVisible();
  await expect(panel.getByText("3.000,00 ₺")).toBeVisible();
  for (let i = 0; i < 4; i++) await panel.getByRole("button", { name: "Adedi artır" }).click(); // 2 → 6
  await panel.getByRole("button", { name: "Adedi artır" }).click(); // 7 atlanır → 8
  await expect(panel.getByText("8 kişi")).toBeVisible();
  await expect(panel.getByText("12.000,00 ₺")).toBeVisible();
  await panel.getByRole("button", { name: "Adedi azalt" }).click();
  await expect(panel.getByText("6 kişi")).toBeVisible();
  await panel.getByRole("button", { name: "Devam et" }).click();
  await expect(page).toHaveURL(/\/odeme\/[\w-]+\.[\w-]+$/);
});

test("başka ziyaretçinin tutması sayfa yenilenmeden planda görünür", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}`);
  await expect(page.getByRole("button", { name: "Masa A2, Standart, boş sandalye 8/8" })).toBeVisible();
  await holdAs(gala.id, tableId(gala, "A2"), 3);
  await expect(page.getByRole("button", { name: "Masa A2, Standart, boş sandalye 5/8" })).toBeVisible({ timeout: 12_000 });
});

test("yetersiz sandalye: mesaj çıkar ve plan hemen güncellenir", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}`);
  await page.getByRole("button", { name: /Masa P1,/ }).click();
  const panel = page.getByRole("region", { name: "Seçiminiz" });
  await panel.getByRole("button", { name: "Adedi artır" }).click(); // 2
  await holdAs(gala.id, tableId(gala, "P1"), 8);
  await panel.getByRole("button", { name: "Devam et" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Bu masa az önce doldu" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Masa P1, Premium, dolu" })).toBeVisible({ timeout: 2000 });
});

test("tarayıcı çekirdeğe hiç istek atmaz ve hiçbir yanıtta sır geçmez", async ({ page }) => {
  const urls: string[] = [];
  const bodies: string[] = [];
  page.on("request", (r) => urls.push(r.url()));
  page.on("response", async (r) => {
    if (/javascript|html|json|x-component/.test(r.headers()["content-type"] ?? "")) bodies.push(await r.text().catch(() => ""));
  });
  await page.goto(`/etkinlik/${gala.id}`);
  await page.getByRole("button", { name: /Masa A3,/ }).click();
  await page.getByRole("region", { name: "Seçiminiz" }).getByRole("button", { name: "Devam et" }).click();
  await expect(page).toHaveURL(/\/odeme\//);
  expect(urls.filter((u) => u.startsWith(fakeState().coreUrl))).toEqual([]);
  expect(bodies.some((b) => b.includes(process.env.SATIS_E2E_SECRET!))).toBe(false);
  const coreUrl = fakeState().coreUrl;
  expect(bodies.some((b) => b.includes(coreUrl))).toBe(false);
});

test("liste görünümünden de seçilir ve 375 px'te taşmaz", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}`);
  await page.getByRole("button", { name: "Liste" }).click();
  await page.getByRole("button", { name: /A4 · Standart · 8\/8/ }).click();
  await expect(page.getByRole("region", { name: "Seçiminiz" }).getByText("Masa A4")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("kisi parametresiyle açılan sayfada masa seçince ilk adet gelir", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}?kisi=4`);
  const panel = page.getByRole("region", { name: "Seçiminiz" });
  await expect(async () => {
    await page.getByRole("button", { name: /Masa A1,/ }).click();
    await expect(panel.getByText("4 kişi")).toBeVisible({ timeout: 1000 });
  }).toPass();
});
