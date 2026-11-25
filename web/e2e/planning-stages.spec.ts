import { randomBytes } from "node:crypto";

import type { Browser, BrowserContext, Page } from "@playwright/test";

import { withDb } from "./support/db";
import { EMPTY_STATE, expect, loginAs, test } from "./support/fixtures";
import { addTablesAndSave, createEvent, fillReservation, publishEvent } from "./support/ui";

// Senaryo tek etkinliğin aşama zincirini sırayla yürütür: her adım bir öncekinin sonucuna dayanır.
test.describe.configure({ mode: "serial" });

const EVENT_NAME = "E2E Aşama Zinciri";
// Parolalar her koşuda rastgele üretilir; yalnızca bellekte yaşar.
const PASSWORD = `Ps-${randomBytes(12).toString("base64url")}`;

type Dept = { username: string; fullName: string; label: string };
const ENT: Dept = { username: "e2e-ent-yonetici", fullName: "Ent Yönetici", label: "Entertainment" };
const FNB: Dept = { username: "e2e-fnb-yonetici", fullName: "Fnb Yönetici", label: "Food & Beverage" };
const CASINO: Dept = { username: "e2e-casino-yonetici", fullName: "Casino Yönetici", label: "Casino" };

let eventId = "";
const contexts: BrowserContext[] = [];
const pages = new Map<string, Page>();

async function createManager(admin: Page, dept: Dept): Promise<void> {
  await admin.goto("/admin/users");
  await admin.getByRole("button", { name: "Yeni kullanıcı" }).click();
  await admin.getByLabel("Kullanıcı adı", { exact: true }).fill(dept.username);
  await admin.getByLabel("Ad soyad").fill(dept.fullName);
  await admin.getByLabel("Rol", { exact: true }).selectOption({ label: "Departman kullanıcısı" });
  await admin.getByLabel(dept.label, { exact: true }).check();
  await admin.getByLabel(`${dept.label} düzeyi`).selectOption({ label: "Yönetici" });
  await admin.getByLabel("Parola", { exact: true }).fill(PASSWORD);
  await admin.getByRole("button", { name: "Kullanıcı oluştur" }).click();
  await expect(admin.getByRole("status").filter({ hasText: "Kullanıcı oluşturuldu" })).toBeVisible();
}

async function sessionFor(browser: Browser, dept: Dept): Promise<Page> {
  const cached = pages.get(dept.username);
  if (cached) return cached;
  const context = await browser.newContext({ storageState: EMPTY_STATE });
  contexts.push(context);
  const page = await context.newPage();
  await loginAs(page, dept.username, PASSWORD);
  await expect(page.getByRole("navigation", { name: "Ana menü" })).toBeVisible();
  pages.set(dept.username, page);
  return page;
}

/** Okunmamış bildirim sayısı (zilin erişilebilir adından); sayfa yeniden yüklenerek taze okunur. */
async function unread(page: Page): Promise<number> {
  await page.goto("/notifications");
  const label = (await page.getByRole("link", { name: /^Bildirimler/ }).first().getAttribute("aria-label")) ?? "";
  const match = /(\d+) okunmamış/.exec(label);
  return match ? Number(match[1]) : 0;
}

async function stageButton(page: Page, name: string): Promise<void> {
  const panel = page.getByRole("region", { name: "Planlama aşaması" });
  await panel.getByRole("button", { name }).click();
}

const currentStep = (page: Page) =>
  page.getByRole("region", { name: "Planlama aşaması" }).locator('[aria-current="step"]');

type TableBox = { label: string; x: number; y: number; cx: number; cy: number };

/** Konva tuvalindeki masalar (bkz. venue-tools.spec.ts): dünya konumu ve ekran merkezi. */
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

async function drag(page: Page, from: TableBox, dx: number, dy: number): Promise<void> {
  await page.mouse.move(from.cx, from.cy);
  await page.mouse.down();
  await page.mouse.move(from.cx + dx / 2, from.cy + dy / 2, { steps: 5 });
  await page.mouse.move(from.cx + dx, from.cy + dy, { steps: 5 });
  await page.mouse.up();
}

test.afterAll(async () => {
  for (const context of contexts) await context.close();
});

test.describe("Planlama aşamaları", () => {
  test("yönetici üç departman yöneticisi ve bir etkinlik oluşturur", async ({ page }) => {
    for (const dept of [ENT, FNB, CASINO]) await createManager(page, dept);
    eventId = await createEvent(page, EVENT_NAME);
    // Yeni etkinlik `defined` aşamasındadır ve panel ayrıntıda görünür.
    await expect(currentStep(page)).toContainText("Tanımlandı");
  });

  test("F&B yerleşimi kaydedip hazır işaretler: F&B zili artar, Entertainment'ınki artmaz", async ({ browser }) => {
    const fnb = await sessionFor(browser, FNB);
    const ent = await sessionFor(browser, ENT);
    const fnbBefore = await unread(fnb);
    const entBefore = await unread(ent);

    await addTablesAndSave(fnb, eventId, [
      { label: "T1", capacity: 4 },
      { label: "T2", capacity: 4 },
    ]);
    await stageButton(fnb, "Yerleşim hazır olarak işaretle");
    await expect(currentStep(fnb)).toContainText("Yerleşim hazır");

    await expect.poll(() => unread(fnb)).toBe(fnbBefore + 1);
    expect(await unread(ent)).toBe(entBefore);
  });

  test("F&B ekip organizasyonundan personel planını hazır işaretler: Entertainment zili artar", async ({ browser }) => {
    const fnb = await sessionFor(browser, FNB);
    const ent = await sessionFor(browser, ENT);
    const entBefore = await unread(ent);

    // Önkoşul: en az bir masa grubu. Kaydedilmeden panel düğmesi sunucuda reddedilir.
    await fnb.goto(`/events/${eventId}/team-organization`);
    await fnb.getByRole("button", { name: "Grup ekle" }).click();
    await fnb.getByRole("button", { name: "Grupsuzları ekle" }).click();
    await fnb.getByRole("button", { name: /Özet ve Kaydet/ }).click();
    await fnb.getByRole("button", { name: "Tümünü kaydet" }).click();
    await expect(fnb.getByRole("status").filter({ hasText: "Organizasyon kaydedildi." })).toBeVisible();

    await stageButton(fnb, "Personel planı hazır olarak işaretle");
    await expect(currentStep(fnb)).toContainText("Personel planı hazır");

    await expect.poll(() => unread(ent)).toBe(entBefore + 1);
  });

  test("Entertainment sınıflar, Casino tahsis eder, Entertainment fiyatlar", async ({ browser }) => {
    const ent = await sessionFor(browser, ENT);
    const casino = await sessionFor(browser, CASINO);

    await ent.goto(`/events/${eventId}`);
    await stageButton(ent, "Masalar sınıflandı olarak işaretle");
    await expect(currentStep(ent)).toContainText("Masalar sınıflandı");

    // Sıradaki işin sahibi Casino: bildirimi ve etkinlik sayfasındaki düğmesi vardır.
    await casino.goto(`/events/${eventId}`);
    await stageButton(casino, "Casino tahsisi tamam olarak işaretle");
    await expect(currentStep(casino)).toContainText("Casino tahsisi tamam");

    await ent.goto(`/events/${eventId}`);
    await stageButton(ent, "Fiyatlandı olarak işaretle");
    await expect(currentStep(ent)).toContainText("Fiyatlandı");
  });

  test("Entertainment yayımlar ve onayla satışı açar; rezervasyonlu masa yerleşimde kilitlenir", async ({ browser, page }) => {
    const ent = await sessionFor(browser, ENT);
    await publishEvent(ent, eventId);

    // Rezervasyon T1'e yapılır; T2 taahhütsüz kalır.
    await page.goto(`/reservations/${eventId}/new`);
    await fillReservation(page, { table: "T1", guests: 2, name: "Kilitli Misafir", phone: "5321110099" });
    await page.waitForURL(new RegExp(`/reservations/${eventId}/[0-9a-f-]{36}$`));

    await ent.goto(`/events/${eventId}`);
    await stageButton(ent, "Satışı aç");
    const dialog = ent.getByRole("alertdialog");
    await expect(dialog).toContainText("kilitlenir");
    await dialog.getByRole("button", { name: "Onayla" }).click();
    await expect(currentStep(ent)).toContainText("Satışta");

    const fnb = await sessionFor(browser, FNB);
    await fnb.goto(`/events/${eventId}/venue`);
    await expect(fnb.getByRole("status").filter({ hasText: "rezervasyonlu masalar kilitli" })).toBeVisible();

    // Kilitli masa taşınamaz; taahhütsüz masa taşınır.
    await expect.poll(async () => (await tableBoxes(fnb)).length).toBe(2);
    const frozenBefore = await tableBox(fnb, "T1");
    await drag(fnb, frozenBefore, 120, 0);
    const frozenAfter = await tableBox(fnb, "T1");
    expect([frozenAfter.x, frozenAfter.y]).toEqual([frozenBefore.x, frozenBefore.y]);

    const freeBefore = await tableBox(fnb, "T2");
    await drag(fnb, freeBefore, 0, 120);
    const freeAfter = await tableBox(fnb, "T2");
    expect(freeAfter.y).toBeGreaterThan(freeBefore.y);

    // Aşama veritabanında da `on_sale`.
    const stage = await withDb((pool) =>
      pool.query<{ planning_stage: string }>("select planning_stage from events where id = $1", [eventId]),
    );
    expect(stage.rows[0]?.planning_stage).toBe("on_sale");
  });
});
