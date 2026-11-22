import path from "node:path";

import { FAKE_CAMERA_FILE } from "./support/constants";
import { expect, test } from "./support/fixtures";
import { checkInKeys, qrTokenFor, reservationsByGuest } from "./support/db";
import { openDevice, seedEvent, type OfflineFixture } from "./support/offline";
import { writeQrY4m } from "./support/qr-video";

// Yerel BarcodeDetector yolu. Başsız Chromium'da BarcodeDetector yoktur; sahte bir uygulama enjekte edilir.
// Bu, uygulamanın yerel motor KOD YOLUNU doğrular (seçim, tek giriş, tekilleştirme, kamera durdurma);
// gerçek bir aygıtın kod çözücüsünü ya da gerçek kamerayı doğrulamaz.
test.describe.configure({ mode: "serial" });

const STAMP = Date.now().toString(36);
const EVENT_NAME = `Yerel Tarayici Gala ${STAMP}`;
const GUEST = "Yerel Tarayici Misafir";
const FAKE_FILE = path.resolve(import.meta.dirname, "..", FAKE_CAMERA_FILE);
const FRAMES_BEFORE_HIT = 3;

let fixture: OfflineFixture;

type FakeState = {
  constructed: Array<{ formats: unknown }>;
  detectCalls: number;
  hits: number;
  streams: MediaStream[];
};

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  fixture = await seedEvent(browser, { eventName: EVENT_NAME, guests: [GUEST], freeTables: 0 });
});

test("yerel BarcodeDetector: yerel motor seçilir, misafir bir kez girer, tekrar okumalar yok sayılır, kamera durur", async ({ browser }) => {
  const token = await qrTokenFor(GUEST);
  writeQrY4m(FAKE_FILE, token);
  const errors: string[] = [];
  const { context, page } = await openDevice(browser, { session: fixture.admin, errors });
  try {
    await context.grantPermissions(["camera"]);
    await page.addInitScript(
      ({ code, framesBeforeHit }) => {
        type Detected = {
          rawValue: string;
          format: string;
          boundingBox: DOMRectReadOnly;
          cornerPoints: Array<{ x: number; y: number }>;
        };
        const state: FakeState = { constructed: [], detectCalls: 0, hits: 0, streams: [] };
        const supported = ["qr_code", "code_128", "ean_13"];

        class FakeBarcodeDetector {
          constructor(options?: { formats?: string[] }) {
            state.constructed.push({ formats: options?.formats ?? null });
          }
          static async getSupportedFormats(): Promise<string[]> {
            return [...supported];
          }
          async detect(source: HTMLVideoElement): Promise<Detected[]> {
            state.detectCalls += 1;
            if (!(source instanceof HTMLVideoElement) || source.readyState < 2) return [];
            // İlk birkaç kare boş; sonra her çağrıda aynı kod (kamera önünde tutulan QR).
            if (state.detectCalls <= framesBeforeHit) return [];
            state.hits += 1;
            return [
              {
                rawValue: code,
                format: "qr_code",
                boundingBox: new DOMRectReadOnly(10, 10, 200, 200),
                cornerPoints: [
                  { x: 10, y: 10 },
                  { x: 210, y: 10 },
                  { x: 210, y: 210 },
                  { x: 10, y: 210 },
                ],
              },
            ];
          }
        }
        Object.defineProperty(window, "BarcodeDetector", { value: FakeBarcodeDetector, configurable: true, writable: true });
        Object.defineProperty(window, "__fakeBarcode", { value: state, configurable: true });

        const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = async (constraints) => {
          const stream = await original(constraints);
          state.streams.push(stream);
          return stream;
        };
      },
      { code: token, framesBeforeHit: FRAMES_BEFORE_HIT },
    );

    const posts: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().endsWith("/api/check-in")) posts.push(r.postData() ?? "");
    });

    await page.goto(`/check-in/${fixture.eventId}`);
    await expect(page.getByRole("heading", { name: EVENT_NAME, level: 1 })).toBeVisible();

    // Sahte, gerçek API biçimini taşır.
    expect(await page.evaluate(() => (window as unknown as { BarcodeDetector: { getSupportedFormats(): Promise<string[]> } }).BarcodeDetector.getSupportedFormats())).toContain("qr_code");

    await page.getByRole("button", { name: "Kamerayla tara" }).click();
    await expect(page.getByText("Kamera açık; QR kodu gösterin")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Giriş yapıldı" })).toContainText(GUEST, { timeout: 30_000 });

    const state = () =>
      page.evaluate(() => {
        const s = (window as unknown as { __fakeBarcode: FakeState }).__fakeBarcode;
        return {
          constructed: s.constructed,
          detectCalls: s.detectCalls,
          hits: s.hits,
          liveTracks: s.streams.flatMap((st) => st.getTracks()).filter((t) => t.readyState === "live").length,
          totalTracks: s.streams.flatMap((st) => st.getTracks()).length,
        };
      });

    // Yerel motor: sahte sınıf `qr_code` biçimiyle kuruldu ve çağrıldı; yedek (html5-qrcode) alanı boş.
    const first = await state();
    expect(first.constructed).toEqual([{ formats: ["qr_code"] }]);
    expect(first.detectCalls).toBeGreaterThan(FRAMES_BEFORE_HIT);
    expect(first.liveTracks).toBeGreaterThan(0);
    await expect(page.getByLabel("Kamera görüntüsü")).toBeVisible();
    expect(await page.locator('[id^="qr-fallback-"]').evaluate((el) => el.childElementCount)).toBe(0);

    // Kod kamera önünde tutulmaya devam eder (her 150 ms'de okunur) ama 4 sn'lik pencerede tekilleştirilir.
    await page.waitForTimeout(2_500);
    const later = await state();
    expect(later.hits, "kod defalarca okundu").toBeGreaterThanOrEqual(first.hits + 5);
    expect(posts, "yalnızca bir istek").toHaveLength(1);
    const [row] = await reservationsByGuest(GUEST);
    expect(row?.status).toBe("checked_in");
    expect(await checkInKeys(row?.id ?? "")).toHaveLength(1);

    // "Kamerayı kapat" akışı durdurur.
    await page.getByRole("button", { name: "Kamerayı kapat" }).click();
    await expect.poll(async () => (await state()).liveTracks).toBe(0);

    // Yeniden aç, sonra sayfadan (istemci yönlendirmesiyle) ayrıl: bileşen kaldırılınca akış durmalı.
    await page.getByRole("button", { name: "Kamerayla tara" }).click();
    await expect.poll(async () => (await state()).liveTracks).toBeGreaterThan(0);
    await page.getByRole("link", { name: "← Etkinlikler" }).click();
    await expect(page).toHaveURL(/\/check-in$/);
    await expect.poll(async () => (await state()).liveTracks).toBe(0);
    expect((await state()).totalTracks).toBeGreaterThanOrEqual(2);
  } finally {
    await context.close();
  }
  expect(errors, "yakalanmamış tarayıcı hataları").toEqual([]);
});
