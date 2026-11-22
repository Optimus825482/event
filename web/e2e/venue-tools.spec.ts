import type { Page } from "@playwright/test";

import { expect, test } from "./support/fixtures";
import { E2E_BASE_URL } from "./support/constants";
import { createEvent } from "./support/ui";

// Senaryolar aynı etkinliğin yerleşimi üzerinde sırayla ilerler (toplu ekleme → sağ tık → hizalama → taslak).
test.describe.configure({ mode: "serial" });

const EVENT_NAME = "E2E Alan Araçları";
let eventId = "";

type TableBox = { label: string; x: number; y: number; cx: number; cy: number };

/**
 * Tuvaldeki masaların dünya konumları (x, y) ve ekrandaki merkezleri (cx, cy).
 * Masalar Konva tuvalinde çizildiğinden DOM'da yoktur; Konva'nın global `Konva.stages` kaydından okunur.
 */
function tableBoxes(page: Page): Promise<TableBox[]> {
  return page.evaluate(() => {
    type Rect = { x: number; y: number; width: number; height: number };
    type KonvaNode = {
      find(selector: string): KonvaNode[];
      getAttr(name: string): unknown;
      getClientRect(): Rect;
      x(): number;
      y(): number;
    };
    type KonvaStage = KonvaNode & { container(): HTMLElement };
    const konva = (window as unknown as { Konva?: { stages: KonvaStage[] } }).Konva;
    const stage = konva?.stages.at(-1);
    if (!stage) return [];
    const box = stage.container().getBoundingClientRect();
    return stage.find(".item").flatMap((item) => {
      const label = item.find("Text")[0]?.getAttr("text");
      if (typeof label !== "string") return [];
      const r = item.getClientRect();
      return [{ label, x: item.x(), y: item.y(), cx: box.left + r.x + r.width / 2, cy: box.top + r.y + r.height / 2 }];
    });
  });
}

async function tableBox(page: Page, label: string): Promise<TableBox> {
  const found = (await tableBoxes(page)).find((t) => t.label === label);
  if (!found) throw new Error(`Tuvalde masa bulunamadı: ${label}`);
  return found;
}

async function drag(page: Page, from: { cx: number; cy: number }, dx: number, dy: number): Promise<void> {
  await page.mouse.move(from.cx, from.cy);
  await page.mouse.down();
  await page.mouse.move(from.cx + dx / 2, from.cy + dy / 2, { steps: 5 });
  await page.mouse.move(from.cx + dx, from.cy + dy, { steps: 5 });
  await page.mouse.up();
}

const stat = (page: Page, label: string) =>
  page.getByRole("region", { name: "İstatistikler" }).getByText(label, { exact: true }).locator("xpath=following-sibling::dd");

const editorStatus = (page: Page, text: string | RegExp) => page.getByRole("status").filter({ hasText: text });

async function openEditor(page: Page): Promise<void> {
  await page.goto(`/events/${eventId}/venue`);
  await expect(page.getByRole("button", { name: "Masa ekle" })).toBeVisible();
}

async function save(page: Page, summary: string): Promise<void> {
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(editorStatus(page, `Yerleşim kaydedildi (${summary})`)).toBeVisible();
}

test.describe("Alan düzenleyicisi araçları", () => {
  test("'Toplu ekle' ile masalar eklenir, sayı artar ve kayıt yenilemede kalır", async ({ page }) => {
    eventId = await createEvent(page, EVENT_NAME);
    await openEditor(page);
    await expect(stat(page, "Toplam Masa")).toHaveText("0");

    await page.getByRole("button", { name: "Toplu ekle" }).click();
    await page.getByRole("menuitem", { name: "Masa Ekle…" }).click();
    const dialog = page.getByRole("dialog", { name: /Masa Ekle/ });
    await expect(dialog.getByText("Adım 1/2")).toBeVisible();
    await dialog.getByLabel("Özel kişi sayısı").fill("8");
    await dialog.getByRole("button", { name: "İleri" }).click();
    await dialog.getByLabel("Adet").fill("4");
    await expect(dialog.getByLabel("Özet")).toContainText("4 adet Masa (8 kişilik)");
    await expect(dialog.getByLabel("Özet")).toContainText("Toplam kapasite: 32 kişi");
    await dialog.getByRole("button", { name: "Ekle", exact: true }).click();
    await expect(dialog).toHaveCount(0);

    await expect(editorStatus(page, "4 masa eklendi.")).toBeVisible();
    await expect(stat(page, "Toplam Masa")).toHaveText("4");
    await expect(stat(page, "Toplam Kapasite")).toHaveText("32");
    await expect.poll(async () => (await tableBoxes(page)).length).toBe(4);

    await save(page, "4 masa, 32 kişi");
    await page.reload();
    await expect(page.getByRole("button", { name: "Masa ekle" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Kaydedilmemiş Taslak Bulundu" })).toHaveCount(0);
    await expect(stat(page, "Toplam Masa")).toHaveText("4");
    await expect(stat(page, "Toplam Kapasite")).toHaveText("32");
    await expect.poll(async () => (await tableBoxes(page)).length).toBe(4);
  });

  test("sağ tık menüsünden 'VIP Yap' ve 'Sabitle' uygulanır; sabit masa sürüklenemez", async ({ page }) => {
    await openEditor(page);
    await expect.poll(async () => (await tableBoxes(page)).length).toBe(4);
    const [first, second] = (await tableBoxes(page)).map((t) => t.label);
    if (!first || !second) throw new Error("En az iki masa gerekli");
    await expect(stat(page, "VIP")).toHaveText("0");

    // VIP Yap: sağ tık masayı seçer ve masanın menüsünü açar.
    let box = await tableBox(page, first);
    await page.mouse.click(box.cx, box.cy, { button: "right" });
    const menu = page.getByRole("menu");
    await expect(menu.getByText(`Masa ${first}`, { exact: true })).toBeVisible();
    await menu.getByRole("menuitem", { name: "VIP Yap" }).click();
    await expect(menu).toHaveCount(0);
    await expect(editorStatus(page, "1 masa VIP yapıldı.")).toBeVisible();
    await expect(stat(page, "VIP")).toHaveText("1");
    const look = page.getByRole("region", { name: "Masa görünümü" });
    await expect(look.getByRole("button", { name: "VIP Kaldır" })).toHaveAttribute("aria-pressed", "true");

    // Sabitle.
    box = await tableBox(page, first);
    await page.mouse.click(box.cx, box.cy, { button: "right" });
    await expect(menu.getByText(`Masa ${first}`, { exact: true })).toBeVisible();
    await menu.getByRole("menuitem", { name: "Sabitle" }).click();
    await expect(menu).toHaveCount(0);
    await expect(editorStatus(page, "1 öğe sabitlendi.")).toBeVisible();
    await expect(look.getByRole("button", { name: "Kilidi Aç" })).toHaveAttribute("aria-pressed", "true");

    // Sabit masa sürüklenince yerinde kalır.
    const pinned = await tableBox(page, first);
    await drag(page, pinned, 0, 160);
    const afterPinned = await tableBox(page, first);
    expect({ x: afterPinned.x, y: afterPinned.y }).toEqual({ x: pinned.x, y: pinned.y });

    // Karşılaştırma: sabit olmayan masa aynı sürüklemeyle yer değiştirir (sürükleme gerçekten çalışıyor).
    const free = await tableBox(page, second);
    await drag(page, free, 0, 160);
    await expect.poll(async () => (await tableBox(page, second)).y).not.toBe(free.y);

    await save(page, "4 masa, 32 kişi");
    await page.reload();
    await expect(stat(page, "VIP")).toHaveText("1");
    await expect.poll(async () => (await tableBoxes(page)).length).toBe(4);
    const reloaded = await tableBox(page, first);
    expect({ x: reloaded.x, y: reloaded.y }).toEqual({ x: pinned.x, y: pinned.y });
  });

  test("'Hizala' → 'Otomatik Hizala' çalışır ve sabit masayı yerinde bırakır", async ({ page }) => {
    await openEditor(page);
    await expect.poll(async () => (await tableBoxes(page)).length).toBe(4);
    const before = await tableBoxes(page);
    const pinned = before[0];
    if (!pinned) throw new Error("Masa yok");

    await page.getByRole("button", { name: "Hizala", exact: true }).click();
    await page.getByRole("menuitem", { name: "Otomatik Hizala" }).click();
    await expect(editorStatus(page, /Tüm masalar hizalandı \(\d+, sabitler hariç\)\./)).toBeVisible();
    await expect(page.getByRole("button", { name: "Kaydet", exact: true })).toBeEnabled();

    const after = await tableBoxes(page);
    expect(after).toHaveLength(4);
    const pinnedAfter = after.find((t) => t.label === pinned.label);
    expect({ x: pinnedAfter?.x, y: pinnedAfter?.y }).toEqual({ x: pinned.x, y: pinned.y });
    const moved = after.filter((t) => {
      const old = before.find((b) => b.label === t.label);
      return old !== undefined && (old.x !== t.x || old.y !== t.y);
    });
    expect(moved.length).toBeGreaterThan(0);
  });

  test("kaydedilmemiş değişiklikten sonra yenilemede taslak kurtarma penceresi çıkar ve taslak yüklenir", async ({ page }) => {
    await openEditor(page);
    await expect(stat(page, "Toplam Masa")).toHaveText("4");

    // Kaydedilmemiş değişiklik: tek masa eklenir; sayfadan çıkış (pagehide) taslağı yazar.
    await page.getByRole("button", { name: "Masa ekle" }).click();
    await expect(stat(page, "Toplam Masa")).toHaveText("5");
    await expect(page.getByRole("button", { name: "Kaydet", exact: true })).toBeEnabled();
    await page.reload();

    const recovery = page.getByRole("dialog", { name: "Kaydedilmemiş Taslak Bulundu" });
    await expect(recovery).toBeVisible();
    await expect(recovery.getByText(/^Son kayıt: \d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2}$/)).toBeVisible();
    // Sunucudaki kayıt hâlâ 4 masa (açık pencere arka planı erişilebilirlik ağacından gizler; tuvalden okunur).
    await expect.poll(async () => (await tableBoxes(page)).length).toBe(4);
    await recovery.getByRole("button", { name: "Taslağı Yükle" }).click();
    await expect(recovery).toHaveCount(0);
    await expect(stat(page, "Toplam Masa")).toHaveText("5");
    await expect(page.getByRole("button", { name: "Kaydet", exact: true })).toBeEnabled();
  });

  test("3B önizleme yerel yazı tipiyle açılır (CDN isteği ve CSP ihlali yok)", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (r) => {
      if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== E2E_BASE_URL) external.push(r.url());
    });
    await openEditor(page);
    await expect(stat(page, "Toplam Masa")).toHaveText("4");
    const font = page.waitForResponse((r) => r.url().endsWith("/fonts/Geist-Regular.ttf"));
    await page.getByRole("button", { name: "3B önizleme" }).click();
    expect((await font).status()).toBe(200);
    expect(external).toEqual([]);
  });

  test("'Çizgi' aracıyla ayırıcı çizgi çizilir, rengi değişir ve kayıt yenilemede kalır", async ({ page }) => {
    // Ayrı etkinlik: önceki senaryoların taslağı/masaları bu senaryoyu etkilemesin.
    eventId = await createEvent(page, "E2E Alan Çizgileri");
    await openEditor(page);
    await page.getByRole("button", { name: "Çizgi", exact: true }).click();
    await expect(page.getByRole("button", { name: "Çizgi", exact: true })).toHaveAttribute("aria-pressed", "true");

    // Tuval istemcide yüklenir; Konva sahnesi oluşana kadar beklenir.
    await page.waitForFunction(() => ((window as unknown as { Konva?: { stages: unknown[] } }).Konva?.stages.length ?? 0) > 0);
    const start = await worldToScreen(page, 200, 200);
    const end = await worldToScreen(page, 600, 210);
    await page.mouse.click(start.x, start.y);
    // Shift yatay kilitler: bitiş y'si başlangıçla aynı olur.
    await page.keyboard.down("Shift");
    await page.mouse.click(end.x, end.y);
    await page.keyboard.up("Shift");
    await expect.poll(async () => (await canvasLines(page)).length).toBe(1);
    const [drawn] = await canvasLines(page);
    expect(drawn?.points[1]).toBe(drawn?.points[3]);
    expect(Math.abs((drawn?.points[2] ?? 0) - (drawn?.points[0] ?? 0))).toBeGreaterThan(300);

    // Esc çizgi aracından seçime döner; seçili çizginin bitiş ucu sürüklenir, Ctrl+Z geri alır.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Çizgi", exact: true })).toHaveAttribute("aria-pressed", "false");
    await page.mouse.click(start.x + (end.x - start.x) / 2, start.y);
    const handle = await worldToScreen(page, drawn?.points[2] ?? 0, drawn?.points[3] ?? 0);
    const target = await worldToScreen(page, drawn?.points[2] ?? 0, 400);
    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await canvasLines(page))[0]?.points[3]).toBe(400);
    await page.keyboard.press("Control+z");
    await expect.poll(async () => (await canvasLines(page))[0]?.points).toEqual(drawn?.points);

    const panel = page.getByRole("region", { name: "Çizgi özellikleri" });
    await expect(panel).toBeVisible();
    await panel.getByRole("radio", { name: "Mavi" }).click();
    await expect(panel.getByRole("radio", { name: "Mavi" })).toHaveAttribute("aria-checked", "true");
    await expect.poll(async () => (await canvasLines(page))[0]?.stroke).toBe("#38bdf8");

    await save(page, "0 masa, 0 kişi");
    await page.reload();
    await expect(page.getByRole("button", { name: "Masa ekle" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Kaydedilmemiş Taslak Bulundu" })).toHaveCount(0);
    await expect.poll(async () => (await canvasLines(page)).length).toBe(1);
    const [reloaded] = await canvasLines(page);
    expect(reloaded).toEqual(drawn && { ...drawn, stroke: "#38bdf8" });
  });
});

/** Dünya koordinatını (tuval pikseli) ekran koordinatına çevirir (Konva sahnesinin ölçek ve kaymasıyla). */
function worldToScreen(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ([wx, wy]) => {
      type KonvaStage = { x(): number; y(): number; scaleX(): number; container(): HTMLElement };
      const stage = (window as unknown as { Konva?: { stages: KonvaStage[] } }).Konva?.stages.at(-1);
      if (!stage) throw new Error("Konva sahnesi yok");
      const box = stage.container().getBoundingClientRect();
      return { x: box.left + stage.x() + wx * stage.scaleX(), y: box.top + stage.y() + wy * stage.scaleX() };
    },
    [x, y] as const,
  );
}

/** Tuvaldeki ayırıcı çizgiler (gövde çizgisinin noktaları ve rengi). */
function canvasLines(page: Page): Promise<Array<{ points: number[]; stroke: string }>> {
  return page.evaluate(() => {
    type KonvaNode = { find(selector: string): KonvaNode[]; getAttr(name: string): unknown };
    const stage = (window as unknown as { Konva?: { stages: KonvaNode[] } }).Konva?.stages.at(-1);
    if (!stage) return [];
    return stage.find(".line-item").flatMap((group) => {
      // Seçim halesi dinlemez; gövde çizgisi `hitStrokeWidth` taşıyan çizgidir.
      const body = group.find("Line").find((l) => typeof l.getAttr("hitStrokeWidth") === "number");
      const points = body?.getAttr("points");
      const stroke = body?.getAttr("stroke");
      return Array.isArray(points) && typeof stroke === "string" ? [{ points: points.map(Number), stroke }] : [];
    });
  });
}
