import { expect, test } from "@playwright/test";
import { expectHeadingOrder } from "./sayfa-yardimcilari";
import { fakeState } from "./support/fake";
import { expectNoHorizontalOverflow } from "./support/layout";

const { gala, bahar } = fakeState().events;

test("ana sayfa: karusel, Gelecek Organizasyonlar ve vekil rotadan gelen görsel", async ({ page }) => {
  const images: { status: number; type: string | undefined; cache: string | undefined }[] = [];
  page.on("response", (r) => {
    if (r.url().includes("/api/gorsel/")) {
      images.push({ status: r.status(), type: r.headers()["content-type"], cache: r.headers()["cache-control"] });
    }
  });
  await page.goto("/");
  await expect(page.getByRole("region", { name: "En yakın etkinlikler" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Gelecek Organizasyonlar" })).toBeVisible();
  // Kartta hero alanı görsel ya da video olabilir; ikisinde de vekil rotadan gelir.
  const card = page.getByRole("article").filter({ hasText: gala.artistName ?? gala.name });
  const media = card.locator("img, video").first();
  await expect(media).toBeVisible();
  const isVideo = await media.evaluate((el) => el instanceof HTMLVideoElement);
  if (isVideo) {
    await expect
      .poll(() => media.evaluate((el: HTMLVideoElement) => el.readyState))
      .toBeGreaterThanOrEqual(2);
    expect(await media.getAttribute("poster")).toMatch(/^\/api\/gorsel\/(event|artist)\/[0-9a-f-]{36}\.webp$/);
  } else {
    await expect.poll(() => media.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    expect(await media.getAttribute("src")).toMatch(/^\/api\/gorsel\/(event|artist)\/[0-9a-f-]{36}\.webp$/);
  }
  expect(images.length).toBeGreaterThan(0);
  expect(images.every((i) => i.status === 200 && i.type === "image/webp" && i.cache === "public, max-age=300")).toBe(
    true,
  );
  await expectHeadingOrder(page);
  await expectNoHorizontalOverflow(page);
});

test("görseli olmayan etkinlik boş kutu değil, altın çizgili metin kartı gösterir", async ({ page }) => {
  await page.goto("/etkinlikler");
  const card = page.getByRole("article").filter({ hasText: bahar.name });
  await expect(card.locator('[data-variant="text"]')).toBeVisible();
  await expect(card.getByRole("img")).toHaveCount(0);
});

test("çekirdekte bulunmayan görsel 404 döner ve kart metne düşer", async ({ page }) => {
  await page.route("**/api/gorsel/**", (route) => route.fulfill({ status: 404, body: "" }));
  await page.goto("/etkinlikler");
  await expect(page.getByRole("article").filter({ hasText: gala.name }).locator('[data-variant="text"]')).toBeVisible();
});

test("görsel rotası geçersiz yolda 404 verir", async ({ request }) => {
  for (const p of ["/api/gorsel/logo/00000000-0000-4000-8000-0000000000c1.webp", "/api/gorsel/event/a.webp"]) {
    expect((await request.get(p)).status()).toBe(404);
  }
});

test("karusel: nokta düğmesi slaytı değiştirir; hareket azaltmada Duraklat yoktur ve sabit görsel çizilir", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "En yakın etkinlikler" });
  await expect(carousel.getByRole("group", { name: "1 / 4" })).toBeVisible();
  // Hareket azaltmada karusel video çizmez; slayt sabit görsel veya metin kartıdır.
  await expect(carousel.locator("video")).toHaveCount(0);
  const heroImg = carousel.getByRole("img", { name: gala.artistName ?? gala.name });
  await expect(heroImg).toBeVisible();
  await expect.poll(() => heroImg.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await expect(carousel.getByRole("button", { name: /Duraklat|Oynat/ })).toHaveCount(0);

  // Nokta düğmesi ikinci slayta geçirir.
  await carousel.getByRole("button", { name: `2. etkinlik: ${bahar.name}` }).click();
  await expect(carousel.getByRole("group", { name: "2 / 4" })).toBeVisible();
  await expect(carousel.getByRole("group", { name: "1 / 4" })).toBeHidden();
});

test("/etkinlikler dört etkinliği tarih sırasıyla listeler", async ({ page }) => {
  await page.goto("/etkinlikler");
  await expect(page.getByRole("heading", { level: 1, name: "Yaklaşan Etkinlikler" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(4);
  await expectHeadingOrder(page);
  await expectNoHorizontalOverflow(page);
});

test("/takvim: arama, ay filtresi ve satış durumu filtresi kartları daraltır", async ({ page }) => {
  await page.goto("/takvim");
  await expect(page.getByRole("heading", { level: 1, name: "2026 Konser & Gala Takvimi" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(4);

  const search = page.getByRole("searchbox", { name: "Sanatçı ara" });
  const month = page.getByRole("combobox", { name: "Ay filtresi" });
  const status = page.getByRole("combobox", { name: "Satış durumu filtresi" });

  await search.fill("Yılbaşı");
  await expect(page.getByRole("article")).toHaveCount(1);
  await search.fill("");

  // Sahte etkinliklerin hepsi Ocak'tır; başka ay seçilince boş durum yazılır.
  await month.selectOption({ label: "Şubat" });
  await expect(page.getByText("Seçili filtrelere uygun etkinlik bulunamadı.")).toBeVisible();
  await month.selectOption({ label: "Ocak" });
  await expect(page.getByRole("article").filter({ hasText: gala.artistName ?? gala.name })).toHaveCount(1);

  // Satışta filtre: satışı kapalı ve bekleyen etkinlikler listeden düşer.
  await status.selectOption({ label: "Satışta" });
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page.getByRole("article").filter({ hasText: bahar.name })).toHaveCount(0);
  await expectHeadingOrder(page);
  await expectNoHorizontalOverflow(page);
});

test("liste sayfaları three.js parçası indirmez", async ({ page }) => {
  const scripts: string[] = [];
  page.on("response", async (res) => {
    if (res.url().includes("/_next/static/") && res.url().endsWith(".js") && res.status() === 200) {
      scripts.push(await res.text());
    }
  });
  await page.goto("/");
  await page.goto("/etkinlikler");
  expect(scripts.length).toBeGreaterThan(0);
  for (const body of scripts) {
    expect(body).not.toContain("WebGLRenderer");
  }
});
