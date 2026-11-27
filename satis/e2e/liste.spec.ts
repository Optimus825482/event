import { expect, test } from "@playwright/test";
import { expectHeadingOrder } from "./sayfa-yardimcilari";
import { fakeState } from "./support/fake";
import { expectNoHorizontalOverflow } from "./support/layout";

const { gala, bahar } = fakeState().events;
const monthOf = (iso: string) =>
  new Intl.DateTimeFormat("tr-TR", { timeZone: "Asia/Famagusta", month: "long", year: "numeric" }).format(new Date(iso));
const ayOf = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Famagusta", year: "numeric", month: "2-digit" }).format(
    new Date(iso),
  );

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
  const img = page.getByRole("article").filter({ hasText: gala.name }).getByRole("img");
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  expect(await img.getAttribute("src")).toMatch(/^\/api\/gorsel\/(event|artist)\/[0-9a-f-]{36}\.webp$/);
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

test("karusel: Sonraki slaytı değiştirir; hareket azaltmada Duraklat yoktur", async ({ page }) => {
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "En yakın etkinlikler" });
  await expect(carousel.getByRole("group", { name: "1 / 4" })).toBeVisible();
  await carousel.getByRole("button", { name: "Sonraki etkinlik" }).click();
  await expect(carousel.getByRole("group", { name: "2 / 4" })).toBeVisible();
  await expect(carousel.getByRole("button", { name: "Duraklat" })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(
    page.getByRole("region", { name: "En yakın etkinlikler" }).getByRole("button", { name: /Duraklat|Oynat/ }),
  ).toHaveCount(0);
});

test("/etkinlikler dört etkinliği tarih sırasıyla listeler", async ({ page }) => {
  await page.goto("/etkinlikler");
  await expect(page.getByRole("heading", { level: 1, name: "Yaklaşan Etkinlikler" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(4);
  await expectHeadingOrder(page);
  await expectNoHorizontalOverflow(page);
});

test("/takvim: etkinliğin ayı, ajanda bağlantısı, ay değiştirme ve bozuk parametre", async ({ page }) => {
  await page.goto("/takvim");
  await expect(page.getByRole("heading", { level: 2, name: monthOf(gala.startsAt), exact: true })).toBeVisible();
  const agenda = page.getByRole("list", { name: "Ayın etkinlikleri" });
  await expect(agenda.getByRole("link", { name: new RegExp(gala.name) })).toHaveAttribute("href", `/etkinlik/${gala.id}`);
  await page.getByRole("link", { name: /→$/ }).click();
  await expect(page).toHaveURL(/\/takvim\?ay=\d{4}-\d{2}$/);
  expect(page.url()).not.toContain(ayOf(gala.startsAt));
  expect((await page.goto("/takvim?ay=abc"))!.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 2, name: monthOf(gala.startsAt), exact: true })).toBeVisible();
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
