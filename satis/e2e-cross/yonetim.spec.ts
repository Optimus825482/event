import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { IMAGE_PATH_PATTERN } from "../src/lib/core/contract";
import { coreContext, salesApi, warmCore } from "./support/core";
import { crossState } from "./support/state";

// 1×1 saydam PNG (bellekte; dosya sistemine yazılmaz).
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

test.describe.configure({ mode: "serial" });
test.use({ extraHTTPHeaders: { "x-real-ip": "10.66.0.1" } });

test.beforeAll(async ({ request }) => {
  test.setTimeout(240_000);
  const { events } = crossState();
  await warmCore(
    request,
    Object.values(events).map((e) => e.id),
  );
});

test("içeriği girilmemiş etkinlik sitede boş kutu göstermez", async ({ page, request }) => {
  const { icerik } = crossState().events;

  const detailRes = await salesApi(request).get(`events/${icerik.id}`);
  expect(detailRes.status()).toBe(200);
  const detail = await detailRes.json();
  expect(detail.coverImage).toBeNull();
  expect(detail.site).toMatchObject({
    heroImage: null,
    summary: null,
    doorsOpenAt: null,
    ageLimit: null,
    dressCode: null,
    sightlineSet: null,
  });

  await page.goto("/");
  const card = page.getByRole("article").filter({ hasText: icerik.name });
  await expect(card).toBeVisible();

  const cardImgs = card.locator("img");
  const cardImgCount = await cardImgs.count();
  for (let i = 0; i < cardImgCount; i++) {
    const img = cardImgs.nth(i);
    await expect(img).toHaveJSProperty("complete", true);
    expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  }

  await page.goto(`/etkinlik/${icerik.id}`);
  await expect(page.getByRole("heading", { level: 1, name: icerik.name })).toBeVisible();
  await expect(page.getByText("Yaş Sınırı")).toHaveCount(0);
  await expect(page.getByText("Kıyafet")).toHaveCount(0);
  await expect(page.getByText("Kapı Açılış")).toHaveCount(0);
});

test("Entertainment site içeriğini ve kapak görselini girer; etkinlik sayfasında görünür", async ({
  page,
  browser,
  request,
}) => {
  const { events, coreUrl } = crossState();
  const { icerik } = events;
  const api = salesApi(request);

  const coreRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().startsWith(coreUrl)) coreRequests.push(r.url());
  });

  const entCtx = await coreContext(browser, "entertainment");
  try {
    const entPage = await entCtx.newPage();
    await entPage.goto("/sales-site");
    await entPage.getByRole("link", { name: icerik.name }).click();
    await expect(entPage).toHaveURL(new RegExp(`/sales-site/${icerik.id}`));
    await expect(entPage.getByRole("link", { name: "Site içeriği" })).toHaveAttribute("aria-current", "page");

    await entPage.getByLabel("Kapak görseli yükle").setInputFiles({
      name: "kapak.png",
      mimeType: "image/png",
      buffer: PNG_1X1,
    });
    await expect(entPage.getByRole("img", { name: "Kapak görseli" })).toBeVisible();

    await entPage.getByLabel("Tanıtım metni").fill("P6 tanıtım metni");
    await entPage.getByLabel("Yaş sınırı").fill("21+");
    await entPage.getByLabel("Kıyafet").fill("Smokin");
    await entPage.getByRole("button", { name: "Kaydet" }).click();
    await expect(entPage.getByText("Site içeriği kaydedildi").first()).toBeVisible();
  } finally {
    await entCtx.close();
  }

  const detailRes = await api.get(`events/${icerik.id}`);
  expect(detailRes.status()).toBe(200);
  const detail = await detailRes.json();
  expect(detail.site).toMatchObject({
    summary: "P6 tanıtım metni",
    ageLimit: "21+",
    dressCode: "Smokin",
  });
  expect(detail.coverImage).toMatch(IMAGE_PATH_PATTERN);

  const imgRes = await request.get(`/api/gorsel/${detail.coverImage}`);
  expect(imgRes.status()).toBe(200);
  expect(imgRes.headers()["content-type"]).toBe("image/webp");

  await expect
    .poll(
      async () => {
        await page.goto(`/etkinlik/${icerik.id}`);
        return await page.getByText("P6 tanıtım metni").isVisible();
      },
      { timeout: 45_000, intervals: [2_000] },
    )
    .toBe(true);

  await expect(page.getByText("21+")).toBeVisible();
  await expect(page.getByText("Smokin")).toBeVisible();

  const loadedCover = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img"));
    return imgs.some((img) => {
      const src = img.currentSrc || img.getAttribute("src") || "";
      return src.includes("gorsel") && img.complete && img.naturalWidth > 0;
    });
  });
  expect(loadedCover).toBe(true);
  expect(coreRequests).toEqual([]);
});

test("görsel vekil rotası bilinmeyen ve desen dışı yolu sunmaz", async ({ request }) => {
  const { coreUrl } = crossState();

  const missing = await request.get(`/api/gorsel/event/${randomUUID()}.webp`);
  expect(missing.status()).toBe(404);
  expect(await missing.text()).not.toContain(coreUrl);

  const invalidKind = await request.get(`/api/gorsel/logo/${randomUUID()}.webp`);
  expect(invalidKind.status()).toBe(404);
  expect(await invalidKind.text()).not.toContain(coreUrl);
});

test("satış başladıktan sonra satış şekli değiştirilemez", async ({ browser, request }) => {
  const { masa } = crossState().events;
  const adminCtx = await coreContext(browser, "admin");
  try {
    const adminPage = await adminCtx.newPage();
    await adminPage.goto(`/events/${masa.id}/tables`);

    const fieldset = adminPage.getByRole("group", { name: "Satış şekli" });
    const seatRadio = fieldset.getByRole("radio", { name: "Sandalye bazlı" });
    await expect(seatRadio).toBeVisible();

    if (await seatRadio.isDisabled()) {
      await expect(fieldset.getByRole("radio", { name: "Masa bazlı" })).toBeDisabled();
      await expect(adminPage.getByText("Satış başladıktan sonra satış şekli değiştirilemez")).toBeVisible();
    } else {
      await seatRadio.check();
      await adminPage.getByRole("button", { name: "Kuralları kaydet" }).click();
      await expect(adminPage.getByText("Satış başladıktan sonra satış şekli değiştirilemez")).toBeVisible();
    }
  } finally {
    await adminCtx.close();
  }

  const detailRes = await salesApi(request).get(`events/${masa.id}`);
  expect(detailRes.status()).toBe(200);
  expect((await detailRes.json()).sale.mode).toBe("table");
});
