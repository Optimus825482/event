import { expect, test } from "@playwright/test";
import { fakeState, resetOrders } from "./support/fake";

const { gala } = fakeState().events;

// Başsız Chromium'da WebGL için yazılım oluşturucu.
test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] } });

test.beforeEach(async () => {
  await resetOrders();
});

test("3B görünüm açılır, seçim 2B'ye dönünce korunur", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
  });
  await page.goto(`/etkinlik/${gala.id}`);
  await page.getByRole("button", { name: /Masa A1,/ }).click();
  const toggle = page.getByRole("button", { name: "3B görünüm" });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(page.getByRole("img", { name: /3B/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Seçim için 2B plan ya da liste görünümünü kullanın.")).toBeVisible();
  const back = page.getByRole("button", { name: "2B görünüm" });
  await expect(back).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Seçiminiz" }).getByText("Boş sandalye 8/8")).toBeVisible();
  expect(violations).toEqual([]);
  await back.click();
  await expect(page.getByRole("button", { name: /Masa A1,/ })).toHaveAttribute("aria-pressed", "true");
  // Normal 2B dönüşü hata sayılmaz: bildirim yok, düğme durur ve 3B yeniden açılır.
  await page.waitForTimeout(1000);
  await expect(page.getByText("3B görünüm açılamadı")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "3B görünüm" })).toBeVisible();
  await page.getByRole("button", { name: "3B görünüm" }).click();
  await expect(page.getByRole("img", { name: /3B/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("3B görünüm açılamadı")).toHaveCount(0);
});

test("WebGL yoksa 3B düğmesi görünmez", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "WebGLRenderingContext", { value: undefined });
    Object.defineProperty(window, "WebGL2RenderingContext", { value: undefined });
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
      return (original as (...a: unknown[]) => unknown).call(this, type, ...rest) as never;
    } as typeof original;
  });
  await page.goto(`/etkinlik/${gala.id}`);
  await expect(page.getByRole("button", { name: /Masa A1,/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "3B görünüm" })).toHaveCount(0);
});

test("3B açılmadan three.js parçası indirilmez", async ({ page }) => {
  const urls: string[] = [];
  page.on("request", (r) => urls.push(r.url()));
  await page.goto(`/etkinlik/${gala.id}`);
  await expect(page.getByRole("button", { name: "3B görünüm" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  const hasThree = async () =>
    (
      await Promise.all(
        urls
          .filter((u) => u.includes("/_next/static/") && u.endsWith(".js"))
          .map(async (u) => (await (await page.request.get(u)).text()).includes("WebGLRenderer")),
      )
    ).some(Boolean);
  expect(await hasThree()).toBe(false);
  await page.getByRole("button", { name: "3B görünüm" }).click();
  await expect(page.getByRole("img", { name: /3B/ })).toBeVisible({ timeout: 30_000 });
  expect(await hasThree()).toBe(true);
});
