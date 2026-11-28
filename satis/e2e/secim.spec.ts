import { expect, test } from "@playwright/test";
import { PARTY_FULL_NOTICE, PROCEED_LABEL } from "../src/features/plan/picks";
import { fakeState, holdAs, resetOrders, tableId } from "./support/fake";
import { disableWebgl, expectNoHorizontalOverflow } from "./support/layout";

const { gala, masa } = fakeState().events;

// Hareket azaltma + WebGL kapalı: salon kesin 2B krokiyle açılır; masa penceresinde kayıtlı sahne görseli gösterilir.
test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  await resetOrders();
  await disableWebgl(page);
});

test("masa penceresinde numaralı düğmelerle iki masadan dört sandalye seçilir ve tutulur", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}/salon?kisi=4`);
  // Plandaki masaya dokununca masa penceresi açılır; kişi sayısı kadar boş sandalye önseçili gelir.
  await page.getByRole("button", { name: /^Masa A1,/ }).click();
  const a1 = page.getByRole("dialog", { name: "Masa A1" });
  await expect(a1).toBeVisible();
  await a1.getByText("Sandalyeleri değiştir").click();
  // 1-3 bırakılıp 7 seçilir; 4 önseçimden kalır.
  for (const no of [1, 2, 3]) await a1.getByRole("button", { name: `Sandalye ${no}, seçili` }).click();
  await a1.getByRole("button", { name: "Sandalye 7, boş" }).click();
  await expect(a1.getByText("Masa A1 · 2 Kişi · Sandalye 4, 7")).toBeVisible();
  await a1.getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(a1).toBeHidden();

  // İkinci masa arama sonuçlarından açılır; kalan kişi sayısı kadar sandalye önseçilir.
  await page.getByRole("searchbox", { name: "Masa numarası ara" }).fill("a2");
  const results = page.getByRole("region", { name: "Masa arama sonuçları" });
  await results.getByRole("button", { name: /^Masa A2/ }).click();
  const a2 = page.getByRole("dialog", { name: "Masa A2" });
  await expect(a2.getByText("Masa A2 · 2 Kişi · Sandalye 1, 2")).toBeVisible();
  await expect(a2.getByText("6.000,00 ₺")).toBeVisible();

  await a2.getByRole("button", { name: PROCEED_LABEL }).click();
  // Tutma başarılı: salonun içinde "Adım 2 · Ödeme" penceresi açılır.
  await expect(page.getByRole("dialog", { name: "Ödeme" })).toBeVisible();

  const availRes = await page.request.get(`/api/durum/${gala.id}`);
  const avail = (await availRes.json()) as { tables: { id: string; freeSeats: number[] }[] };
  expect(avail.tables.find((t) => t.id === tableId(gala, "A1"))?.freeSeats).toEqual([1, 2, 3, 5, 6, 8]);
  expect(avail.tables.find((t) => t.id === tableId(gala, "A2"))?.freeSeats).toEqual([3, 4, 5, 6, 7, 8]);
});

test("yuva boşluğu olan masada olmayan numara sunulmaz", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}/salon?kisi=2`);
  await page.getByRole("button", { name: /^Masa G1,/ }).click();
  const dialog = page.getByRole("dialog", { name: "Masa G1" });
  await dialog.getByText("Sandalyeleri değiştir").click();
  for (const no of [1, 2, 3, 5, 6, 8]) {
    await expect(dialog.getByRole("button", { name: new RegExp(`Sandalye ${no},`) })).toBeVisible();
  }
  await expect(dialog.getByRole("button", { name: /Sandalye 4,/ })).toHaveCount(0);
  await expect(dialog.getByText("2 sandalye satışa kapalı.")).toBeVisible();
});

test("kişi sayısı dolunca yeni sandalye seçilmez ve uyarı çıkar", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}/salon?kisi=2`);
  await page.getByRole("button", { name: /^Masa A1,/ }).click();
  const dialog = page.getByRole("dialog", { name: "Masa A1" });
  await dialog.getByText("Sandalyeleri değiştir").click();
  await expect(dialog.getByRole("button", { name: "Sandalye 1, seçili" })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("button", { name: "Sandalye 2, seçili" })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Sandalye 3, boş" }).click();
  await expect(dialog.getByText(PARTY_FULL_NOTICE)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Sandalye 3, boş" })).toHaveAttribute("aria-pressed", "false");
});

test("başkası seçili sandalyeyi alınca seçimden düşer ve uyarı çıkar", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}/salon?kisi=2`);
  await page.getByRole("button", { name: /^Masa A1,/ }).click();
  const dialog = page.getByRole("dialog", { name: "Masa A1" });
  await expect(dialog.getByText("Masa A1 · 2 Kişi · Sandalye 1, 2")).toBeVisible();
  await dialog.getByText("Sandalyeleri değiştir").click();

  await holdAs(gala.id, tableId(gala, "A1"), 1, [1]);
  await expect(dialog.getByText(/1 numaralı sandalye az önce alındı/)).toBeVisible({ timeout: 12_000 });
  await expect(dialog.getByRole("button", { name: "Sandalye 1, dolu" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: PROCEED_LABEL })).toBeDisabled();
  await expect(page.getByRole("status").getByText("1/2 kişi seçildi")).toBeVisible();
});

test("tutma anında sandalye alınmışsa mesaj çıkar ve plan hemen güncellenir", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}/salon?kisi=2`);
  await page.getByRole("button", { name: /^Masa P1,/ }).click();
  const dialog = page.getByRole("dialog", { name: "Masa P1" });
  await expect(dialog.getByText("Masa P1 · 2 Kişi · Sandalye 1, 2")).toBeVisible();
  await dialog.getByText("Sandalyeleri değiştir").click();

  await holdAs(gala.id, tableId(gala, "P1"), 2, [1, 2]);
  await dialog.getByRole("button", { name: PROCEED_LABEL }).click();
  await expect(dialog.getByRole("alert").filter({ hasText: "Seçtiğiniz sandalyelerden biri az önce alındı" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Sandalye 1, dolu" })).toBeVisible({ timeout: 12_000 });
});

test("masa bazlı etkinlikte masa bütün seçilir", async ({ page }) => {
  await page.goto(`/etkinlik/${masa.id}/salon?kisi=2`);
  await page.getByRole("button", { name: /^Masa A1,/ }).click();
  const dialog = page.getByRole("dialog", { name: "Masa A1" });
  // Numaralı sandalye yoktur; masa bütün olarak seçilir.
  await expect(dialog.getByText("Masa A1 · 8 Kişi (bütün masa)")).toBeVisible();
  await dialog.getByText("Sandalyeleri değiştir").click();
  await expect(dialog.getByText("8 kişilik masa · 8 bilet")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Seçimi kaldır" })).toBeVisible();
  await dialog.getByRole("button", { name: PROCEED_LABEL }).click();
  await expect(page.getByRole("dialog", { name: "Ödeme" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Ödeme" }).getByText("Masa A1")).toBeVisible();
});

test("loca süzgeci ve masa numarası araması sonuç listesini daraltır", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}/salon?kisi=2`);
  const filter = page.getByRole("group", { name: "Alan filtresi" });
  const search = page.getByRole("searchbox", { name: "Masa numarası ara" });
  const results = page.getByRole("region", { name: "Masa arama sonuçları" });

  // Loca süzgeci: aramada yalnızca loca listelenir; plandaki masalar sönükleşir.
  await filter.getByRole("button", { name: "Loca", exact: true }).click();
  await search.fill("1");
  await expect(results.getByRole("button")).toHaveCount(1);
  await expect(results.getByRole("button", { name: /^Loca L1/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Masa A1,/ })).toHaveAttribute("data-dimmed", "true");

  // Tümü + numara araması yalnız o masayı verir.
  await filter.getByRole("button", { name: "Tümü" }).click();
  await search.fill("p2");
  await expect(results.getByRole("button")).toHaveCount(1);
  await expect(results.getByRole("button", { name: /^Masa P2/ })).toBeVisible();
});

test("klavyeyle seçim: Enter pencereyi açar, odak pencereye geçer, Boşluk sandalyeyi seçer, Esc kapatır", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}/salon?kisi=1`);
  const a1Btn = page.getByRole("button", { name: /^Masa A1,/ });
  await a1Btn.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Masa A1" });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);

  await dialog.getByText("Sandalyeleri değiştir").click();
  const s1Btn = dialog.getByRole("button", { name: "Sandalye 1, seçili" });
  await s1Btn.focus();
  await page.keyboard.press(" ");
  await expect(dialog.getByRole("button", { name: "Sandalye 1, boş" })).toHaveAttribute("aria-pressed", "false");
  await expect(dialog.getByRole("button", { name: PROCEED_LABEL })).toBeDisabled();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Sandalye 2, boş" })).toBeFocused();
  await page.keyboard.press(" ");
  await expect(dialog.getByRole("button", { name: "Sandalye 2, seçili" })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("button", { name: PROCEED_LABEL })).toBeEnabled();

  // Esc pencereyi kapatır (değiştirilmiş seçim korunur), odak açan masaya döner.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(a1Btn).toBeFocused();
  await expect(page.getByRole("button", { name: "Devam et" })).toBeEnabled();
});

test("başka ziyaretçinin tutması sayfa yenilenmeden planda görünür", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}/salon?kisi=2`);
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
  await page.goto(`/etkinlik/${gala.id}/salon?kisi=1`);
  await page.getByRole("searchbox", { name: "Masa numarası ara" }).fill("a3");
  await page.getByRole("region", { name: "Masa arama sonuçları" }).getByRole("button", { name: /^Masa A3/ }).click();
  const dialog = page.getByRole("dialog", { name: "Masa A3" });
  await expect(dialog.getByText("Masa A3 · 1 Kişi · Sandalye 1")).toBeVisible();
  await dialog.getByRole("button", { name: PROCEED_LABEL }).click();
  await expect(page.getByRole("dialog", { name: "Ödeme" })).toBeVisible();
  expect(urls.filter((u) => u.startsWith(fakeState().coreUrl))).toEqual([]);
  expect(bodies.some((b) => b.includes(process.env.SATIS_E2E_SECRET!))).toBe(false);
  const coreUrl = fakeState().coreUrl;
  expect(bodies.some((b) => b.includes(coreUrl))).toBe(false);
});

test("375 px'te taşmaz; kontrol çubuğu planın üstündedir", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/etkinlik/${gala.id}/salon?kisi=2`);
  await expectNoHorizontalOverflow(page);
  const planBox = await page.getByRole("group", { name: "Salon planı" }).boundingBox();
  const panelBox = await page.getByLabel("Kişi sayısı", { exact: true }).boundingBox();
  expect(planBox).not.toBeNull();
  expect(panelBox).not.toBeNull();
  // Tam genişlik arenada kişi sayısı çubuğu üst kontrol çubuğundadır, planın altında değil.
  expect(panelBox!.y).toBeLessThan(planBox!.y);
});

test("sahne görüşü dosyası kendi kökenimizden sunulur", async ({ page }) => {
  const res = await page.request.get("/sightline/diamond/M-1.webp");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/webp");

  await page.goto(`/etkinlik/${gala.id}/salon?kisi=2`);
  await page.getByRole("button", { name: /^Masa A1,/ }).click();
  const dialog = page.getByRole("dialog", { name: "Masa A1" });
  // 2B kipte masa penceresi sahne alanını gösterir; A1 etiketi kayıtlı görsel adına normalleşmez, yedek metin yazılır.
  await expect(dialog.getByText("Bu konum için kayıtlı sahne görseli yok.")).toBeVisible();
  await expect(dialog.getByText("Masa A1 — Sahne Görünümü")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Masadan Sahneye Bak" })).toBeDisabled();
});
