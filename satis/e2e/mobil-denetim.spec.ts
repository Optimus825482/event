import { test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fillBuyer } from "./support/checkout";
import { fakeState, holdAs, resetOrders, tableId } from "./support/fake";

test.use({
  launchOptions: {
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  },
});

type Finding = {
  route: string;
  width: number;
  kind: "overflow" | "offender" | "ios-zoom" | "tap" | "console";
  detail: string;
};

// Çıktı, Turbopack'in izlemediği gitignore'lu dizinde olmalı; MD_OUT_DIR paralel koşulda ayrı dizine işaret eder.
const OUT = resolve(import.meta.dirname, process.env.MD_OUT_DIR ?? "../test-results/mobil-denetim");
mkdirSync(OUT, { recursive: true });
const findings: Finding[] = [];

function flush() {
  writeFileSync(resolve(OUT, "bulgular.json"), JSON.stringify(findings, null, 2));
}

async function settle(page: Page) {
  // Geliştirme sunucusu HMR/yeniden derleme sırasında sayfayı yenileyebilir; evaluate yarışını yut.
  await page.evaluate(() => document.fonts.ready).catch(() => undefined);
  await page.waitForTimeout(350);
}

async function auditLayout(page: Page, route: string, width: number) {
  const measure = () =>
    page.evaluate(() => {
    const doc = document.documentElement;
    const vw = doc.clientWidth;
    const offenders: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > vw + 1 || r.left < -1) {
        const name = `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}.${String(el.className ?? "").slice(0, 90)}`;
        offenders.push(`${name} [left=${Math.round(r.left)} right=${Math.round(r.right)} w=${Math.round(r.width)}]`);
      }
    }
    // iOS Safari otomatik yakınlaştırmasını tetikleyen 16px altı METİN alanları.
    // Onay kutusu/radyo/aralık/renk alanları odak yakınlaştırması tetiklemez; hariç tutulur.
    const smallInputs: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea"))) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (el instanceof HTMLInputElement && ["checkbox", "radio", "range", "color", "file", "hidden", "submit", "button"].includes(el.type)) continue;
      const size = parseFloat(style.fontSize);
      if (size < 16) smallInputs.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} ${size}px`);
    }
    // 40x40 altı dokunma hedefleri (yalnızca görünür etkileşimli öğeler).
    const smallTaps: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("a[href], button, summary, [role=button], input[type=checkbox], input[type=radio]"))) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < 40 || r.height < 40) {
        const name = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
        smallTaps.push(`${el.tagName.toLowerCase()} "${name}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return { scrollWidth: doc.scrollWidth, vw, offenders, smallInputs, smallTaps };
    });

  // Gezinme/HMR evaluate'i bölerse bir kez daha dene; yine olmazsa bu ölçümü atla.
  let report: Awaited<ReturnType<typeof measure>> | null = null;
  try {
    report = await measure();
  } catch {
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    await page.waitForTimeout(300);
    report = await measure().catch(() => null);
  }
  if (!report) return;

  if (report.scrollWidth > report.vw + 1) {
    findings.push({ route, width, kind: "overflow", detail: `scrollWidth=${report.scrollWidth} > ${report.vw}` });
  }
  for (const item of report.offenders.slice(0, 8)) findings.push({ route, width, kind: "offender", detail: item });
  for (const item of report.smallInputs.slice(0, 8)) findings.push({ route, width, kind: "ios-zoom", detail: item });
  for (const item of report.smallTaps.slice(0, 10)) findings.push({ route, width, kind: "tap", detail: item });
  flush();
}

async function auditRoute(page: Page, route: string, widths: number[], opts?: { screenshotAt?: number }) {
  for (const width of widths) {
    console.log(`[denetim] ${route} @ ${width}px`);
    await page.setViewportSize({ width, height: 812 });
    await page.goto(route, { waitUntil: "load", timeout: 20_000 }).catch(() => undefined);
    await settle(page);
    await auditLayout(page, route, width);
    if (opts?.screenshotAt === width) {
      const safe = route.replace(/[^a-z0-9]+/gi, "_").slice(0, 60) || "kok";
      await page.screenshot({ path: resolve(OUT, `${safe}-${width}.png`), fullPage: true }).catch(() => undefined);
    }
  }
}

test("mobil denetim", async ({ page }) => {
  // 18 rota × 3 genişlik + menü/pencere/ödeme/e-bilet senaryoları; ilk derlemeler yavaş olduğu için geniş bütçe.
  test.setTimeout(45 * 60_000);
  await resetOrders();
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      findings.push({ route: page.url(), width: 0, kind: "console", detail: msg.text().slice(0, 200) });
    }
  });

  const { gala, bahar, kapali, masa } = fakeState().events;
  const order = await holdAs(gala.id, tableId(gala, "V2"), 2);
  const orderMasa = await holdAs(masa.id, tableId(masa, "G1"), 6);

  const routes: string[] = [
    "/",
    "/etkinlikler",
    "/takvim",
    "/hakkimizda",
    "/sss",
    "/iade",
    "/kvkk",
    "/mesafeli-satis",
    "/biletimi-bul",
    `/etkinlik/${gala.id}`,
    `/etkinlik/${masa.id}`,
    `/etkinlik/${bahar.id}`,
    `/etkinlik/${kapali.id}`,
    `/etkinlik/${gala.id}/salon?kisi=2`,
    `/etkinlik/${masa.id}/salon?kisi=2`,
    `/etkinlik/${kapali.id}/salon`,
    `/odeme/${order.orderToken}`,
    `/odeme/${orderMasa.orderToken}`,
  ];

  // MD_SKIP_ROUTES=1 ile yalnız etkileşim senaryoları koşar (rota taraması ayrı doğrulandıysa).
  const skipRoutes = process.env.MD_SKIP_ROUTES === "1";
  if (!skipRoutes) {
    for (const route of routes) {
      await auditRoute(page, route, [320, 375, 768], { screenshotAt: 375 });
    }

    // Mobil menü açık hâli.
    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/");
      await settle(page);
      await page.getByText("Menü", { exact: true }).click();
      await settle(page);
      await auditLayout(page, "/ (menü açık)", width);
      await page.screenshot({ path: resolve(OUT, `menu-${width}.png`) });
    }
  }

  // Bilet penceresi (kişi sayısı) ve masa penceresi.
  // Tetikleyici `hideTrigger` olduğu için görünmez; pencere `#bilet-al` hash'iyle otomatik açılır (ticket-dialog.tsx:50).
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto(`/etkinlik/${gala.id}#bilet-al`, { waitUntil: "load" });
    await settle(page);
    await auditLayout(page, "/etkinlik (bilet penceresi)", width);
    await page.screenshot({ path: resolve(OUT, `bilet-pencere-${width}.png`) });
  }

  // Önceki adımın #bilet-al hash gezinmesi salon yüklemesini böler; nötr sayfaya düşüp tek kez yeniden dene.
  await page.goto("about:blank").catch(() => undefined);
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 812 });
    try {
      await page.goto(`/etkinlik/${gala.id}/salon?kisi=2`, { waitUntil: "load", timeout: 30_000 });
    } catch {
      await page.goto("about:blank").catch(() => undefined);
      await page.goto(`/etkinlik/${gala.id}/salon?kisi=2`, { waitUntil: "load", timeout: 30_000 });
    }
    await settle(page);
    await page.getByLabel("Masa numarası ara").fill("A1");
    await page.getByRole("region", { name: "Masa arama sonuçları" }).getByRole("button", { name: /^Masa A1/ }).click();
    await page.waitForTimeout(500);
    await auditLayout(page, "/salon (masa penceresi)", width);
    await page.screenshot({ path: resolve(OUT, `masa-pencere-${width}.png`) });
  }

  // Ödeme formu doldurulmuş hâlde (hata mesajları dâhil).
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto(`/odeme/${order.orderToken}`, { waitUntil: "load" });
    await settle(page);
    const pay = page.getByRole("button", { name: "Öde" });
    if (await pay.count()) {
      await pay.click().catch(() => undefined);
      await page.waitForTimeout(500);
    }
    await auditLayout(page, "/odeme (form doğrulama)", width);
    await page.screenshot({ path: resolve(OUT, `odeme-dogrulama-${width}.png`), fullPage: true });
  }

  // Ödeme sonrası e-bilet: PNR ve QR kartlarının dar ekran düzeni.
  const ticketOrder = await holdAs(gala.id, tableId(gala, "P2"), 2);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/odeme/${ticketOrder.orderToken}`, { waitUntil: "load" });
  await fillBuyer(page);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Öde" }).click();
  await page.waitForURL(/\/bilet\//, { timeout: 30_000 });
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 812 });
    await settle(page);
    await auditLayout(page, "/bilet (ödeme sonrası)", width);
    await page.screenshot({ path: resolve(OUT, `bilet-${width}.png`), fullPage: true });
  }

  writeFileSync(resolve(OUT, "bulgular.json"), JSON.stringify(findings, null, 2));
  console.log(`\n=== MOBİL DENETİM: ${findings.length} bulgu ===`);
  for (const f of findings) console.log(`${f.kind} | ${f.width}px | ${f.route} | ${f.detail}`);
});
