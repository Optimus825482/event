import { expect, test } from "@playwright/test";
import { fakeState, resetOrders, tableId } from "./support/fake";

const { gala } = fakeState().events;

// Başsız Chromium'da WebGL için yazılım oluşturucu.
test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] } });

test.beforeEach(async () => {
  await resetOrders();
});

test("yetenekli cihazda 3B kendiliğinden açılır, 2B düğmesi kalır, seçim iki görünümde korunur", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
  });
  await page.goto(`/etkinlik/${gala.id}/salon?kisi=2`);
  const sceneBox = page.getByTestId("plan-3d-scene");
  await expect(sceneBox).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  await expect(page.getByRole("img", { name: "Salon planı (3B)" })).toBeVisible();

  await page.getByLabel("Masa numarası ara").fill("A1");
  await page.getByRole("region", { name: "Masa arama sonuçları" }).getByRole("button", { name: /^Masa A1/ }).click();
  const a1Dialog = page.getByRole("dialog", { name: "Masa A1" });
  await a1Dialog.getByText("Sandalyeleri değiştir").click();
  await a1Dialog.getByRole("button", { name: "Sandalye 2, seçili" }).click();
  await a1Dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(a1Dialog).toBeHidden();

  const toggle2d = page.getByRole("button", { name: "2B görünüm" });
  await expect(toggle2d).toHaveAttribute("aria-pressed", "true");
  await toggle2d.click();

  await expect(page.getByRole("group", { name: "Salon planı" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Masa A1,/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status").getByText("1/2 kişi seçildi")).toBeVisible();
  expect(violations).toEqual([]);

  await page.getByRole("button", { name: "3B görünüm" }).click();
  await expect(page.getByTestId("plan-3d-scene")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
});

test("masa seçilince kamera yakınlaşmaz; pencere kapanınca önseçim geri alınır ve 3B kamerası sabit kalır", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}/salon?kisi=2`);
  const sceneBox = page.getByTestId("plan-3d-scene");
  await expect(sceneBox).toHaveAttribute("data-ready", "true", { timeout: 30_000 });

  await page.getByLabel("Masa numarası ara").fill("A1");
  await page.getByRole("region", { name: "Masa arama sonuçları" }).getByRole("button", { name: /^Masa A1/ }).click();
  await expect(sceneBox).toHaveAttribute("data-camera", "overview");

  // Dokunulmadan kapatılan pencere önseçimi geri alır.
  const a1Dialog = page.getByRole("dialog", { name: "Masa A1" });
  await a1Dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(a1Dialog).toBeHidden();
  await expect(page.getByRole("status").getByText("0/2 kişi seçildi")).toBeVisible();
});

test("3B'de masadan bak kamerayı masadan sahneye çevirir", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}/salon?kisi=2`);
  const sceneBox = page.getByTestId("plan-3d-scene");
  await expect(sceneBox).toHaveAttribute("data-ready", "true", { timeout: 30_000 });

  const a1Id = tableId(gala, "A1");
  await page.getByLabel("Masa numarası ara").fill("A1");
  await page.getByRole("region", { name: "Masa arama sonuçları" }).getByRole("button", { name: /^Masa A1/ }).click();
  await page.getByRole("dialog", { name: "Masa A1" }).getByRole("button", { name: "Masadan Sahneye Bak" }).click();
  await expect(sceneBox).toHaveAttribute("data-camera", `seat:${a1Id}`, { timeout: 10_000 });
  await page.getByRole("group", { name: "Kamera" }).getByRole("button", { name: "Genel" }).click();
  await expect(sceneBox).toHaveAttribute("data-camera", "overview", { timeout: 10_000 });
});

test("WebGL bağlamı kaybolursa 2B'ye bildirimle düşer, seçim korunur", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}/salon?kisi=2`);
  const sceneBox = page.getByTestId("plan-3d-scene");
  await expect(sceneBox).toHaveAttribute("data-ready", "true", { timeout: 30_000 });

  await page.getByLabel("Masa numarası ara").fill("A1");
  await page.getByRole("region", { name: "Masa arama sonuçları" }).getByRole("button", { name: /^Masa A1/ }).click();
  const a1Dialog = page.getByRole("dialog", { name: "Masa A1" });
  await a1Dialog.getByText("Sandalyeleri değiştir").click();
  await a1Dialog.getByRole("button", { name: "Sandalye 2, seçili" }).click();
  await a1Dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(a1Dialog).toBeHidden();

  const lost = await page.evaluate(() => {
    const gl = document.querySelector("canvas")?.getContext("webgl2") ?? document.querySelector("canvas")?.getContext("webgl");
    const ext = gl?.getExtension("WEBGL_lose_context");
    ext?.loseContext();
    return Boolean(ext);
  });
  expect(lost).toBe(true);

  await expect(page.getByText("3B görünüm açılamadı; 2B plan gösteriliyor.")).toBeVisible();
  await expect(page.getByRole("status").getByText("1/2 kişi seçildi")).toBeVisible();
});

test("reduced motion açıkken 3B açılır; WebGL yokken 2B plan gösterilir ve three.js parçası indirilmez", async ({ browser }) => {
  const ctx1 = await browser.newContext({ reducedMotion: "reduce" });
  const page1 = await ctx1.newPage();
  await page1.goto(`/etkinlik/${gala.id}/salon?kisi=2`);
  await expect(page1.getByTestId("plan-3d-scene")).toHaveAttribute("data-ready", "true", { timeout: 15_000 });
  await expect(page1.getByRole("button", { name: "2B görünüm" })).toBeVisible();
  await ctx1.close();

  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  const urls: string[] = [];
  page2.on("request", (r) => urls.push(r.url()));
  await page2.addInitScript(() => {
    Object.defineProperty(window, "WebGLRenderingContext", { value: undefined });
    Object.defineProperty(window, "WebGL2RenderingContext", { value: undefined });
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
      return (original as (...a: unknown[]) => unknown).call(this, type, ...rest) as never;
    } as typeof original;
  });
  await page2.goto(`/etkinlik/${gala.id}/salon?kisi=2`);
  await expect(page2.getByRole("group", { name: "Salon planı" })).toBeVisible();
  await expect(page2.getByRole("button", { name: "3B görünüm" })).toHaveCount(0);
  await expect(page2.getByText(/WebGL \(donanım hızlandırma\) kapalı veya desteklenmiyor/)).toBeVisible();
  await page2.waitForLoadState("networkidle");
  const hasThree = (
    await Promise.all(
      urls
        .filter((u) => u.includes("/_next/static/") && u.endsWith(".js"))
        .map(async (u) => (await (await page2.request.get(u)).text()).includes("WebGLRenderer")),
    )
  ).some(Boolean);
  expect(hasThree).toBe(false);
  await ctx2.close();
});
