import { expect, test } from "@playwright/test";
import { FAKE_IMAGES } from "../tests/helpers/fake-core";
import { expectHeadingOrder } from "./sayfa-yardimcilari";
import { fakeState } from "./support/fake";
import { expectNoHorizontalOverflow } from "./support/layout";

const { gala } = fakeState().events;

test("başlıkta altın logo yüklenir ve ana sayfaya bağlanır; sekme simgeleri sunulur", async ({ page, request }) => {
  await page.goto("/takvim");
  const home = page.getByRole("banner").getByRole("link", { name: "Merit Entertainment — Ana sayfa" });
  await expect(home).toHaveAttribute("href", "/");
  const logo = home.locator("img");
  await expect.poll(() => logo.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  expect(await logo.evaluate((el) => el.getBoundingClientRect().height)).toBe(46);

  for (const rel of ["icon", "apple-touch-icon"]) {
    const href = await page.locator(`head link[rel="${rel}"]`).first().getAttribute("href");
    expect(href).toBeTruthy();
    const res = await request.get(href!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
  }
});

test("alt bilgi: logo, iletişim ve yeni sekmede açılan sosyal medya bağlantıları", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: "Merit Entertainment — Ana sayfa" })).toBeVisible();
  const social = footer.getByRole("navigation", { name: "Sosyal Medya" });
  const instagram = social.getByRole("link", { name: /Instagram/ });
  await expect(instagram).toHaveAttribute("href", "https://www.instagram.com/merit.entertainment/");
  await expect(instagram).toHaveAttribute("target", "_blank");
  await expect(instagram).toHaveAttribute("rel", "noopener noreferrer");
  await expect(social.getByRole("link", { name: /Facebook/ })).toHaveAttribute(
    "href",
    "https://www.facebook.com/meritentertainment/",
  );
  await expect(social.getByRole("link", { name: /YouTube|TikTok|WhatsApp/ })).toHaveCount(0);
  await expect(footer.getByRole("link", { name: "+90 392 650 40 00" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("hakkımızda: prototipteki üç tanıtım kartı görünür; 375 px'te taşmaz", async ({ page }) => {
  await page.goto("/hakkimizda");
  await expect(page.getByRole("heading", { level: 1, name: "Merit Entertainment" })).toBeVisible();
  for (const name of ["Modern Organizasyon Alanları", "Ses, Işık & Sahne Teknolojisi", "Seçkin Misafir Deneyimi"]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  await expectHeadingOrder(page);
  await expectNoHorizontalOverflow(page);
});

test("etkinlik üst görseli tanıtım görselidir; azaltılmış harekette kapak görseli seçilir", async ({ browser }) => {
  for (const [reducedMotion, expected] of [
    ["no-preference", FAKE_IMAGES.hero],
    ["reduce", FAKE_IMAGES.cover],
  ] as const) {
    const context = await browser.newContext({ reducedMotion, viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    await page.goto(`/etkinlik/${gala.id}`);
    const img = page.getByRole("img", { name: gala.artistName! });
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    expect(await img.evaluate((el: HTMLImageElement) => new URL(el.currentSrc).pathname)).toBe(
      `/api/gorsel/${expected}`,
    );
    await context.close();
  }
});

test("ana sayfadaki etkinlik kartı tanıtım medyasını ve azaltılmış harekette sanatçı afişini gösterir", async ({ page }) => {
  await page.goto("/");
  const reel = page.getByRole("article").filter({ has: page.locator(`a[href="/etkinlik/${gala.id}"]`) });
  const image = reel.getByRole("img", { name: gala.artistName! });
  for (const [preference, expected] of [["no-preference", FAKE_IMAGES.hero], ["reduce", FAKE_IMAGES.artist]] as const) {
    await page.emulateMedia({ reducedMotion: preference });
    await expect.poll(() => image.evaluate((el: HTMLImageElement) => new URL(el.currentSrc).pathname))
      .toBe(`/api/gorsel/${expected}`);
  }
});
