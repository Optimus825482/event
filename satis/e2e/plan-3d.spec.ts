import { expect, test } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";
import { buildPlanModel } from "../src/features/plan/model";
import { detailPose, FOV_HALL } from "../src/features/plan/three/camera";
import { buildScene } from "../src/features/plan/three/scene-data";
import { towardStage } from "../src/features/plan/three/stage";
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

  await page.getByRole("region", { name: "Masa bulucu" }).getByRole("button", { name: /^Masa A1 ·/ }).click();
  const a1Dialog = page.getByRole("dialog", { name: "Masa A1" });
  await a1Dialog.getByRole("button", { name: "Sandalye 2, seçili" }).click();
  await a1Dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(a1Dialog).toBeHidden();

  const toggle2d = page.getByRole("button", { name: "2B görünüm" });
  await expect(toggle2d).toHaveAttribute("aria-pressed", "true");
  await toggle2d.click();

  await expect(page.getByRole("group", { name: "Salon planı" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Masa A1,/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Seçiminiz" }).getByText("1/2 kişi seçildi")).toBeVisible();
  expect(violations).toEqual([]);

  await page.getByRole("button", { name: "3B görünüm" }).click();
  await expect(page.getByTestId("plan-3d-scene")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
});

test("masa seçilince kamera masaya yakınlaşır; 3B'de sandalyeye tıklamak panelde aynı numarayı seçer", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}/salon?kisi=2`);
  const sceneBox = page.getByTestId("plan-3d-scene");
  await expect(sceneBox).toHaveAttribute("data-ready", "true", { timeout: 30_000 });

  const a1Id = tableId(gala, "A1");
  await page.getByRole("region", { name: "Masa bulucu" }).getByRole("button", { name: /^Masa A1 ·/ }).click();
  await expect(sceneBox).toHaveAttribute("data-camera", `detail:${a1Id}`, { timeout: 10_000 });
  // Dokunulmadan kapatılan pencere önseçimi geri alır; 3B'de sandalyeler tek tek seçilir.
  const a1Dialog = page.getByRole("dialog", { name: "Masa A1" });
  await a1Dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(a1Dialog).toBeHidden();
  const summary = page.getByRole("region", { name: "Seçiminiz" });
  await expect(summary.getByText("0/2 kişi seçildi")).toBeVisible();

  const availRes = await page.request.get(`/api/durum/${gala.id}`);
  const avail = await availRes.json();
  const model = buildPlanModel(gala.plan, gala.prices, avail, gala.sale.mode);
  const scene = buildScene({ model, picks: [], activeTableId: a1Id });
  const t = scene.tables.find((x) => x.key === a1Id)!;
  const pose = detailPose({ x: t.x, z: t.z }, t.floorY, towardStage(scene.stage, { x: t.x, z: t.z }));
  const chair3 = scene.chairs.find((c) => c.tableId === a1Id && c.seatNo === 3)!;

  await sceneBox.scrollIntoViewIfNeeded();
  const box = await sceneBox.boundingBox();
  expect(box).not.toBeNull();
  const cam = new PerspectiveCamera(FOV_HALL, box!.width / box!.height, 0.1, 1000);
  cam.position.set(...pose.position);
  cam.lookAt(...pose.target);
  cam.updateMatrixWorld();
  const ndc = new Vector3(chair3.x, chair3.y + 0.25, chair3.z).project(cam);
  const px = box!.x + ((ndc.x + 1) / 2) * box!.width;
  const py = box!.y + ((1 - ndc.y) / 2) * box!.height;

  await page.mouse.click(px, py);
  await expect(summary.getByText("Masa A1 · sandalye 3")).toBeVisible();
  await expect(summary.getByText("1/2 kişi seçildi")).toBeVisible();

  await page.mouse.click(px, py);
  await expect(summary.getByText("0/2 kişi seçildi")).toBeVisible();
  await expect(summary.getByText("Masa A1 · sandalye 3")).toHaveCount(0);
});

test("3B'de masadan bak kamerayı masadan sahneye çevirir", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}/salon?kisi=2`);
  const sceneBox = page.getByTestId("plan-3d-scene");
  await expect(sceneBox).toHaveAttribute("data-ready", "true", { timeout: 30_000 });

  const a1Id = tableId(gala, "A1");
  await page.getByRole("region", { name: "Masa bulucu" }).getByRole("button", { name: /^Masa A1 ·/ }).click();
  await page.getByRole("dialog", { name: "Masa A1" }).getByRole("button", { name: "Masadan Sahneye Bak" }).click();
  await expect(sceneBox).toHaveAttribute("data-camera", `seat:${a1Id}`, { timeout: 10_000 });
  // Sağdaki panelin düğmesi de aynı bakışı açar.
  await page.getByRole("group", { name: "Kamera" }).getByRole("button", { name: "Genel" }).click();
  await page.getByRole("button", { name: "3B'de masadan bak" }).click();
  await expect(sceneBox).toHaveAttribute("data-camera", `seat:${a1Id}`, { timeout: 10_000 });
});

test("WebGL bağlamı kaybolursa 2B'ye bildirimle düşer, seçim korunur, masadan bak düğmesi kalkar", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}/salon?kisi=2`);
  const sceneBox = page.getByTestId("plan-3d-scene");
  await expect(sceneBox).toHaveAttribute("data-ready", "true", { timeout: 30_000 });

  await page.getByRole("region", { name: "Masa bulucu" }).getByRole("button", { name: /^Masa A1 ·/ }).click();
  const a1Dialog = page.getByRole("dialog", { name: "Masa A1" });
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
  await expect(page.getByRole("region", { name: "Seçiminiz" }).getByText("1/2 kişi seçildi")).toBeVisible();
  await expect(page.getByRole("button", { name: "3B'de masadan bak" })).toHaveCount(0);
});

test("reduced motion ya da WebGL yokken 2B plan gösterilir ve three.js parçası indirilmez", async ({ browser }) => {
  const ctx1 = await browser.newContext({ reducedMotion: "reduce" });
  const page1 = await ctx1.newPage();
  const urls: string[] = [];
  page1.on("request", (r) => urls.push(r.url()));
  await page1.goto(`/etkinlik/${gala.id}/salon?kisi=2`);
  await expect(page1.getByRole("group", { name: "Salon planı" })).toBeVisible();
  await page1.waitForLoadState("networkidle");
  const hasThree = (
    await Promise.all(
      urls
        .filter((u) => u.includes("/_next/static/") && u.endsWith(".js"))
        .map(async (u) => (await (await page1.request.get(u)).text()).includes("WebGLRenderer")),
    )
  ).some(Boolean);
  expect(hasThree).toBe(false);
  await ctx1.close();

  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
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
  await ctx2.close();
});
