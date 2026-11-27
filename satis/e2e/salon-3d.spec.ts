import { expect, test, type Page } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";
import type { EventDetail } from "../src/lib/core/contract";
import { buildPlanModel } from "../src/features/plan/model";
import { detailPose, FOV_HALL, maxDistance, orbitMove } from "../src/features/plan/three/camera";
import { PROCEED_LABEL } from "../src/features/plan/picks";
import { formatStageMetrics, tableStageMetrics } from "../src/features/plan/stage-metrics";
import { buildScene } from "../src/features/plan/three/scene-data";
import { towardStage } from "../src/features/plan/three/stage";
import { addDiamondEvent, gotoListedEvent } from "./support/diamond";
import { fakeState, tableId } from "./support/fake";

// Başsız Chromium'da WebGL için yazılım oluşturucu; salon masaüstü genişliğinde gezilir.
test.use({
  viewport: { width: 1280, height: 900 },
  launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
});

let open: EventDetail;
let closed: EventDetail;

test.beforeAll(async ({ browser }) => {
  open = await addDiamondEvent("Diamond Açık Gece", "open");
  closed = await addDiamondEvent("Diamond Kapalı Gece", "closed");
  // Soğuk geliştirme sunucusu ilk derlemede sayfayı art arda yeniler; tohumlu etkinlikle bir kez ısıtılır.
  test.setTimeout(180_000);
  const page = await browser.newPage();
  await page.goto(`/etkinlik/${fakeState().events.gala.id}?kisi=2#masa-secimi`);
  await expect(page.getByTestId("plan-3d-scene")).toHaveAttribute("data-ready", "true", { timeout: 120_000 });
  await page.close();
});

async function sceneReady(page: Page) {
  const scene = page.getByTestId("plan-3d-scene");
  await expect(scene).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  return scene;
}

async function expectSightlinePhoto(page: Page, label: string) {
  const panel = page.getByRole("region", { name: "Sahne görüşü" });
  const img = panel.getByRole("img");
  await expect(img).toHaveAttribute("src", `/sightline/diamond/${label}.webp`);
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await expect(panel.getByText(`Masa ${label} · Sahne görüşü`)).toBeVisible();
}

test("satış kapalıyken de 3B salon açılır; masaya dokununca o masanın sahne görüşü fotoğrafı gelir", async ({ page }) => {
  test.setTimeout(180_000);
  await gotoListedEvent(page, `/etkinlik/${closed.id}#masa-secimi`);
  const scene = await sceneReady(page);
  await expect(page.getByRole("img", { name: "Salon planı (3B)" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Sahne görüşü" }).getByRole("img")).toHaveAttribute(
    "src",
    "/sightline/diamond/overview.webp",
  );

  // Listeden M-40 seçilince kamera ona yakınlaşır; oradan görünen başka bir masaya 3B'de dokunulur.
  const m40Id = tableId(closed, "M-40");
  await page.getByLabel("Masa veya loca").selectOption({ label: "Masa M-40" });
  await expect(scene).toHaveAttribute("data-camera", `detail:${m40Id}`, { timeout: 10_000 });
  await expectSightlinePhoto(page, "M-40");
  // Satış kapalı: masa penceresi bilgi, fotoğraf ve satış durumunu gösterir; ödemeye geçiş yoktur.
  const m40Dialog = page.getByRole("dialog", { name: "Masa M-40" });
  await expect(m40Dialog.getByRole("img")).toHaveAttribute("src", "/sightline/diamond/M-40.webp");
  await expect(m40Dialog.getByText("Satış kapalı")).toBeVisible();
  await expect(m40Dialog.getByRole("button", { name: PROCEED_LABEL })).toHaveCount(0);
  await m40Dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(m40Dialog).toBeHidden();

  // Yerleşim doluluktan bağımsızdır; tazeyken tüm sandalyeler boştur.
  const availability = {
    at: new Date().toISOString(),
    tables: closed.plan.tables.map((t) => ({ id: t.id, free: t.seatNos.length, freeSeats: [...t.seatNos] })),
  };
  const model = buildPlanModel(closed.plan, closed.prices, availability, closed.sale.mode);
  const data = buildScene({ model, picks: [], activeTableId: m40Id });
  const m40 = data.tables.find((t) => t.key === m40Id)!;
  // İki kez uzaklaştırınca komşu masalar kadraja girer (kamera düğmesi uçuşsuz, belirlenimli konum verir).
  const bar = page.getByRole("group", { name: "Kamera" });
  await bar.getByRole("button", { name: "Uzaklaştır" }).click();
  await bar.getByRole("button", { name: "Uzaklaştır" }).click();
  await expect(scene).toHaveAttribute("data-camera", "free");
  const detail = detailPose({ x: m40.x, z: m40.z }, m40.floorY, towardStage(data.stage, { x: m40.x, z: m40.z }));
  const pose = orbitMove(orbitMove(detail, "out", maxDistance(data.room)), "out", maxDistance(data.room));
  await scene.scrollIntoViewIfNeeded();
  const box = (await scene.boundingBox())!;
  const cam = new PerspectiveCamera(FOV_HALL, box.width / box.height, 0.1, 1000);
  cam.position.set(...pose.position);
  cam.lookAt(...pose.target);
  cam.updateMatrixWorld();
  // Kadrajda, ekran ortasına en yakın ikinci masa (M-40'ın kendisi değil).
  const [other, ndc] = data.tables
    .filter((t) => t.key !== m40Id && !t.isLoca)
    .map((t) => [t, new Vector3(t.x, t.floorY + 0.65, t.z).project(cam)] as const)
    .filter(([, p]) => Math.abs(p.x) < 0.7 && Math.abs(p.y) < 0.7 && p.z < 1)
    .sort(([, a], [, b]) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0]!;
  await page.mouse.click(box.x + ((ndc.x + 1) / 2) * box.width, box.y + ((1 - ndc.y) / 2) * box.height);

  await expect(scene).toHaveAttribute("data-camera", `detail:${other.key}`, { timeout: 10_000 });
  await expectSightlinePhoto(page, other.label);
  await expect(page.getByRole("button", { name: "Devam et" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Sandalye \d+/ })).toHaveCount(0);

  // 3B'de dokunulan masanın penceresinden "Masadan Sahneye Bak" kamerayı o masaya götürür ve pencereyi kapatır.
  const otherDialog = page.getByRole("dialog", { name: `Masa ${other.label}` });
  await otherDialog.getByRole("button", { name: "Masadan Sahneye Bak" }).click();
  await expect(otherDialog).toBeHidden();
  await expect(scene).toHaveAttribute("data-camera", `seat:${other.key}`, { timeout: 10_000 });
});
test("satış kapalıyken 2B planda da masaya dokununca sahne görüşü değişir", async ({ page }) => {
  test.setTimeout(180_000);
  await gotoListedEvent(page, `/etkinlik/${closed.id}#masa-secimi`);
  await sceneReady(page);

  await page.getByRole("button", { name: "2B görünüm" }).click();
  await page.getByRole("group", { name: "Salon planı" }).getByRole("button", { name: /^Masa M-90,/ }).click();
  await expectSightlinePhoto(page, "M-90");
});

test("açık satışta kişi sayısı verilmeden de 3B salon, sahne görüşü ve 2 kişilik seçim paneli görünür", async ({ page }) => {
  test.setTimeout(180_000);
  await gotoListedEvent(page, `/etkinlik/${open.id}#masa-secimi`);
  await expect(page.getByText("Kaç kişisiniz?")).toHaveCount(0);
  await sceneReady(page);
  await expect(page.getByRole("region", { name: "Sahne görüşü" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Bilet seçimi" }).getByLabel("Kişi sayısı")).toHaveValue("2");
  await expect(page.getByRole("region", { name: "Seçiminiz" }).getByText("0/2 kişi seçildi")).toBeVisible();
});

test("açık satışta masa seçilince sahne görüşü fotoğrafı gelir ve masadan bakış da sunulur", async ({ page }) => {
  test.setTimeout(180_000);
  await gotoListedEvent(page, `/etkinlik/${open.id}?kisi=2#masa-secimi`);
  const scene = await sceneReady(page);
  await page.getByRole("region", { name: "Masa bulucu" }).getByRole("button", { name: /^Masa M-40 ·/ }).click();
  await expectSightlinePhoto(page, "M-40");

  // Masa penceresi: sahne görüşü fotoğrafı, plandaki sahneye göre mesafe · açı, önseçili 2 sandalye.
  const dialog = page.getByRole("dialog", { name: "Masa M-40" });
  const photo = dialog.getByRole("img");
  await expect(photo).toHaveAttribute("src", "/sightline/diamond/M-40.webp");
  await expect.poll(() => photo.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await expect(dialog.getByText("Masa M-40 — Sahne Görünümü")).toBeVisible();
  const availability = {
    at: new Date().toISOString(),
    tables: open.plan.tables.map((t) => ({ id: t.id, free: t.seatNos.length, freeSeats: [...t.seatNos] })),
  };
  const model = buildPlanModel(open.plan, open.prices, availability, open.sale.mode);
  const m40 = model.tables.find((t) => t.label === "M-40")!;
  const metrics = tableStageMetrics(model, m40);
  expect(metrics).not.toBeNull();
  await expect(dialog.getByText(formatStageMetrics(metrics!), { exact: true })).toBeVisible();
  await expect(dialog.getByText("Masa M-40 · 2 Kişi · Sandalye 1, 2")).toBeVisible();
  await expect(dialog.getByRole("button", { name: PROCEED_LABEL })).toBeEnabled();
  await expect(dialog.getByText(/KDV/)).toHaveCount(0);

  await dialog.getByRole("button", { name: "Masadan Sahneye Bak" }).click();
  await expect(dialog).toBeHidden();
  await expect(scene).toHaveAttribute("data-camera", `seat:${tableId(open, "M-40")}`, { timeout: 10_000 });
  // Sahneye bakmak seçimi bırakmaz.
  await expect(page.getByRole("region", { name: "Seçiminiz" }).getByText("2/2 kişi seçildi")).toBeVisible();
});

test("kamera düğmeleri tuvalin dışındadır ve genel görünüme döndürür", async ({ page }) => {
  test.setTimeout(180_000);
  await gotoListedEvent(page, `/etkinlik/${closed.id}#masa-secimi`);
  const scene = await sceneReady(page);
  const bar = page.getByRole("group", { name: "Kamera" });
  const barBox = (await bar.boundingBox())!;
  const sceneBox = (await scene.boundingBox())!;
  expect(barBox.y + barBox.height).toBeLessThanOrEqual(sceneBox.y);
  await bar.getByRole("button", { name: "Üstten" }).click();
  await expect(scene).toHaveAttribute("data-camera", "top", { timeout: 10_000 });
  await bar.getByRole("button", { name: "Genel" }).click();
  await expect(scene).toHaveAttribute("data-camera", "overview", { timeout: 10_000 });
});
