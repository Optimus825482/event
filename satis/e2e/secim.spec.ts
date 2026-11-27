import { expect, test } from "@playwright/test";
import { PARTY_FULL_NOTICE } from "../src/features/plan/picks";
import { SIGHTLINE_CAPTION } from "../src/features/plan/sightline";
import { fakeState, holdAs, resetOrders, tableId } from "./support/fake";
import { expectNoHorizontalOverflow } from "./support/layout";

const { gala, masa } = fakeState().events;

// 2B yolu kesinleşsin diye
test.use({ reducedMotion: "reduce" });

test.beforeEach(async () => {
  await resetOrders();
});

test("numaralı düğmelerle iki masadan dört sandalye seçilir ve tutulur", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}?kisi=4#masa-secimi`);
  const finder = page.getByRole("region", { name: "Masa bulucu" });
  await finder.getByRole("button", { name: /^Masa A1 ·/ }).click();
  await page.getByRole("button", { name: "Sandalye 4, boş" }).click();
  await page.getByRole("button", { name: "Sandalye 7, boş" }).click();

  await finder.getByRole("button", { name: /^Masa A2 ·/ }).click();
  await page.getByRole("button", { name: "Sandalye 1, boş" }).click();
  await page.getByRole("button", { name: "Sandalye 2, boş" }).click();

  const summary = page.getByRole("region", { name: "Seçiminiz" });
  await expect(summary.getByText("4/4 kişi seçildi")).toBeVisible();
  await expect(summary.getByText("6.000,00 ₺")).toBeVisible();
  await summary.getByRole("button", { name: "Devam et" }).click();
  await expect(page).toHaveURL(/\/odeme\/[\w-]+\.[\w-]+$/);

  const availRes = await page.request.get(`/api/durum/${gala.id}`);
  const avail = (await availRes.json()) as { tables: { id: string; freeSeats: number[] }[] };
  expect(avail.tables.find((t) => t.id === tableId(gala, "A1"))?.freeSeats).toEqual([1, 2, 3, 5, 6, 8]);
  expect(avail.tables.find((t) => t.id === tableId(gala, "A2"))?.freeSeats).toEqual([3, 4, 5, 6, 7, 8]);
});

test("yuva boşluğu olan masada olmayan numara sunulmaz", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}?kisi=2#masa-secimi`);
  await page.getByRole("region", { name: "Masa bulucu" }).getByRole("button", { name: /^Masa G1 ·/ }).click();
  for (const no of [1, 2, 3, 5, 6, 8]) {
    await expect(page.getByRole("button", { name: new RegExp(`Sandalye ${no},`) })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: /Sandalye 4,/ })).toHaveCount(0);
  await expect(page.getByText("2 sandalye satışa kapalı.")).toBeVisible();
});

test("kişi sayısı dolunca yeni sandalye seçilmez ve uyarı çıkar", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}?kisi=2#masa-secimi`);
  await page.getByRole("region", { name: "Masa bulucu" }).getByRole("button", { name: /^Masa A1 ·/ }).click();
  await page.getByRole("button", { name: "Sandalye 1, boş" }).click();
  await page.getByRole("button", { name: "Sandalye 2, boş" }).click();
  await page.getByRole("button", { name: "Sandalye 3, boş" }).click();
  await expect(page.getByText(PARTY_FULL_NOTICE)).toBeVisible();
  await expect(page.getByRole("button", { name: "Sandalye 3, boş" })).toHaveAttribute("aria-pressed", "false");
});

test("başkası seçili sandalyeyi alınca seçimden düşer ve uyarı çıkar", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}?kisi=2#masa-secimi`);
  await page.getByRole("region", { name: "Masa bulucu" }).getByRole("button", { name: /^Masa A1 ·/ }).click();
  await page.getByRole("button", { name: "Sandalye 4, boş" }).click();
  await page.getByRole("button", { name: "Sandalye 7, boş" }).click();

  await holdAs(gala.id, tableId(gala, "A1"), 1, [4]);
  await expect(page.getByText(/4 numaralı sandalye az önce alındı/)).toBeVisible({ timeout: 12_000 });
  await expect(page.getByRole("button", { name: "Sandalye 4, dolu" })).toBeDisabled();
  await expect(page.getByRole("region", { name: "Seçiminiz" }).getByText("1/2 kişi seçildi")).toBeVisible();
});

test("tutma anında sandalye alınmışsa mesaj çıkar ve plan hemen güncellenir", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}?kisi=2#masa-secimi`);
  await page.getByRole("region", { name: "Masa bulucu" }).getByRole("button", { name: /^Masa P1 ·/ }).click();
  await page.getByRole("button", { name: "Sandalye 1, boş" }).click();
  await page.getByRole("button", { name: "Sandalye 2, boş" }).click();

  await holdAs(gala.id, tableId(gala, "P1"), 2, [1, 2]);
  await page.getByRole("region", { name: "Seçiminiz" }).getByRole("button", { name: "Devam et" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Seçtiğiniz sandalyelerden biri az önce alındı" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sandalye 1, dolu" })).toBeVisible({ timeout: 12_000 });
});

test("masa bazlı etkinlikte masa bütün seçilir", async ({ page }) => {
  await page.goto(`/etkinlik/${masa.id}?kisi=2#masa-secimi`);
  await page.getByRole("region", { name: "Masa bulucu" }).getByRole("button", { name: /^Masa A1 ·/ }).click();
  await expect(page.getByText("8 kişilik masa · 8 bilet")).toBeVisible();
  await expect(page.getByRole("button", { name: /Sandalye/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Masanın tamamını seç" }).click();
  await page.getByRole("region", { name: "Seçiminiz" }).getByRole("button", { name: "Devam et" }).click();
  await expect(page).toHaveURL(/\/odeme\//);
});

test("loca bütün seçilir; Loca süzgeci ve masa numarası araması listeyi daraltır", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}?kisi=2#masa-secimi`);
  const finder = page.getByRole("region", { name: "Masa bulucu" });
  await finder.getByRole("button", { name: "Loca", exact: true }).click();
  const list = finder.getByRole("list", { name: "Alınabilir masalar" });
  await expect(list.getByRole("button")).toHaveCount(1);
  await expect(list.getByRole("button", { name: /^Loca L1 ·/ })).toBeVisible();

  await finder.getByRole("button", { name: "Tümü" }).click();
  await finder.getByRole("searchbox", { name: "Masa numarası ara" }).fill("p2");
  await expect(list.getByRole("button")).toHaveCount(1);
  await expect(list.getByRole("button", { name: /^Masa P2 ·/ })).toBeVisible();
});

test("klavyeyle seçim: Tab ile sandalyeye gelinir, Boşluk seçer, Devam et'e ulaşılır", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}?kisi=1#masa-secimi`);
  const a1Btn = page.getByRole("region", { name: "Masa bulucu" }).getByRole("button", { name: /^Masa A1 ·/ });
  await a1Btn.focus();
  await page.keyboard.press("Enter");

  const s1Btn = page.getByRole("button", { name: "Sandalye 1, boş" });
  await s1Btn.focus();
  await page.keyboard.press(" ");
  await expect(page.getByRole("button", { name: "Sandalye 1, seçili" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Seçiminiz" }).getByRole("button", { name: "Devam et" })).toBeEnabled();
});

test("başka ziyaretçinin tutması sayfa yenilenmeden planda görünür", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}?kisi=2#masa-secimi`);
  await expect(page.getByRole("button", { name: "Masa A2, Standart, boş sandalye 8/8" })).toBeVisible();
  await holdAs(gala.id, tableId(gala, "A2"), 3);
  await expect(page.getByRole("button", { name: "Masa A2, Standart, boş sandalye 5/8" })).toBeVisible({ timeout: 12_000 });
});

test("tarayıcı çekirdeğe hiç istek atmaz ve hiçbir yanıtta sır geçmez", async ({ page }) => {
  const urls: string[] = [];
  const bodies: string[] = [];
  page.on("request", (r) => urls.push(r.url()));
  page.on("response", async (r) => {
    if (/javascript|html|json|x-component/.test(r.headers()["content-type"] ?? "")) {
      bodies.push(await r.text().catch(() => ""));
    }
  });
  await page.goto(`/etkinlik/${gala.id}?kisi=1#masa-secimi`);
  await page.getByRole("region", { name: "Masa bulucu" }).getByRole("button", { name: /^Masa A3 ·/ }).click();
  await page.getByRole("button", { name: "Sandalye 1, boş" }).click();
  await page.getByRole("region", { name: "Seçiminiz" }).getByRole("button", { name: "Devam et" }).click();
  await expect(page).toHaveURL(/\/odeme\//);
  expect(urls.filter((u) => u.startsWith(fakeState().coreUrl))).toEqual([]);
  expect(bodies.some((b) => b.includes(process.env.SATIS_E2E_SECRET!))).toBe(false);
  const coreUrl = fakeState().coreUrl;
  expect(bodies.some((b) => b.includes(coreUrl))).toBe(false);
});

test("375 px'te taşmaz; panel planın altındadır", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/etkinlik/${gala.id}?kisi=2#masa-secimi`);
  await expectNoHorizontalOverflow(page);
  const planBox = await page.getByRole("group", { name: "Salon planı" }).boundingBox();
  const panelBox = await page.getByRole("region", { name: "Seçiminiz" }).boundingBox();
  expect(planBox).not.toBeNull();
  expect(panelBox).not.toBeNull();
  expect(planBox!.y).toBeLessThan(panelBox!.y);
});

test("sahne görüşü dosyası kendi kökenimizden sunulur", async ({ page }) => {
  const res = await page.request.get("/sightline/diamond/M-1.webp");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/webp");

  await page.goto(`/etkinlik/${gala.id}?kisi=2#masa-secimi`);
  await page.getByRole("region", { name: "Masa bulucu" }).getByRole("button", { name: /^Masa A1 ·/ }).click();
  await expect(page.getByText(SIGHTLINE_CAPTION)).toBeVisible();
});
