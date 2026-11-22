import sharp from "sharp";

import { expect, test } from "./support/fixtures";
import { openDevice, seedEvent, openConsoleAndWarm, type OfflineFixture } from "./support/offline";

// PWA yüklenebilirliği: Chromium'un yükleme ölçütleri (manifest alanları, gerçek PNG simgeler, service worker, CDP hataları).
const STAMP = Date.now().toString(36);
const EVENT_NAME = `PWA Gala ${STAMP}`;

type ManifestIcon = { src: string; sizes?: string; type?: string; purpose?: string };
type Manifest = {
  name?: string;
  short_name?: string;
  start_url?: string;
  scope?: string;
  display?: string;
  icons?: ManifestIcon[];
};

let fixture: OfflineFixture;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  fixture = await seedEvent(browser, { eventName: EVENT_NAME, guests: ["PWA Misafir"], freeTables: 0 });
});

test("manifest: yükleme için gereken alanlar, 192/512 PNG ve maskable simge gerçekten sunulur", async ({ browser }) => {
  const errors: string[] = [];
  const { context, page } = await openDevice(browser, { session: fixture.admin, errors });
  try {
    await page.goto(`/check-in/${fixture.eventId}`);
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(href).toBe("/manifest.webmanifest");

    const response = await page.request.get(href ?? "");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/json/);
    const manifest = (await response.json()) as Manifest;

    expect(manifest.name?.trim()).toBeTruthy();
    expect(manifest.short_name?.trim()).toBeTruthy();
    expect(["standalone", "fullscreen", "minimal-ui"]).toContain(manifest.display);

    const origin = new URL(page.url()).origin;
    const scope = new URL(manifest.scope ?? "/", `${origin}/`);
    const start = new URL(manifest.start_url ?? "", `${origin}/`);
    expect(start.origin).toBe(origin);
    expect(start.pathname.startsWith(scope.pathname), "start_url kapsam içinde").toBe(true);

    const icons = manifest.icons ?? [];
    const sizesOf = (icon: ManifestIcon) => (icon.sizes ?? "").split(/\s+/);
    for (const size of [192, 512]) {
      const icon = icons.find((i) => i.type === "image/png" && sizesOf(i).includes(`${size}x${size}`) && (i.purpose ?? "any").includes("any"));
      expect(icon, `${size}x${size} PNG (purpose any) bildirilmeli`).toBeTruthy();
    }
    expect(icons.some((i) => (i.purpose ?? "").split(/\s+/).includes("maskable") && i.type === "image/png")).toBe(true);

    // Bildirilen her PNG gerçekten 200 + image/png döner ve bildirilen boyuta çözülür.
    for (const icon of icons.filter((i) => i.type === "image/png")) {
      const res = await page.request.get(new URL(icon.src, `${origin}/`).toString());
      expect(res.status(), icon.src).toBe(200);
      expect(res.headers()["content-type"], icon.src).toContain("image/png");
      const meta = await sharp(await res.body()).metadata();
      expect(meta.format, icon.src).toBe("png");
      expect(`${meta.width}x${meta.height}`, icon.src).toBe(sizesOf(icon)[0]);
    }
  } finally {
    await context.close();
  }
  expect(errors, "yakalanmamış tarayıcı hataları").toEqual([]);
});

test("service worker denetliyor, fetch işleyicisi var ve CDP yüklenebilirlik hatası bildirmiyor", async ({ browser }) => {
  const errors: string[] = [];
  const { context, page } = await openDevice(browser, { session: fixture.admin, errors });
  try {
    // Çevrimdışı kabuğun gerçekten sunulması offline-checkin/offline-session belirtimlerinde doğrulanır; burada kayıt ve işleyici.
    await openConsoleAndWarm(page, fixture.eventId, EVENT_NAME);
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    const script = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return registration?.active?.scriptURL ?? null;
    });
    expect(script).toMatch(/\/sw\.js$/);
    const source = await (await page.request.get(script ?? "")).text();
    expect(source).toMatch(/addEventListener\(\s*["']fetch["']/);

    const cdp = await context.newCDPSession(page);
    const result = (await cdp.send("Page.getInstallabilityErrors")) as { installabilityErrors: Array<{ errorId: string }> };
    expect(result.installabilityErrors.map((e) => e.errorId)).toEqual([]);
  } finally {
    await context.close();
  }
  expect(errors, "yakalanmamış tarayıcı hataları").toEqual([]);
});
