import { randomBytes } from "node:crypto";

import type { Browser, BrowserContext, Page } from "@playwright/test";

import { seatSlotCount, tableAllocation } from "./support/db";
import { createManager, openSession, type Dept } from "./support/departments";
import { expect, test } from "./support/fixtures";
import { addTablesAndSave, createEvent, fillReservation, publishEvent } from "./support/ui";

// Senaryo tek etkinliğin masa sınıflandırma, tahsis ve rezervasyon akışını sırayla yürütür.
test.describe.configure({ mode: "serial" });

const EVENT_NAME = "E2E Masa Tahsisi";
// Parolalar her koşuda rastgele üretilir; yalnızca bellekte yaşar.
const PASSWORD = `Ps1-${randomBytes(12).toString("base64url")}`;

const ENT: Dept = { username: "e2e-seat-ent-yonetici", fullName: "Seat Ent Yönetici", label: "Entertainment" };
const CASINO: Dept = { username: "e2e-seat-casino-yonetici", fullName: "Seat Casino Yönetici", label: "Casino" };

const GUEST = "Tahsis Misafiri";
const BOOKING_CODE = /^R[2-9A-HJ-NP-Z]{6}$/;

let eventId = "";
const contexts: BrowserContext[] = [];
const pages = new Map<string, Page>();

async function sessionFor(browser: Browser, dept: Dept): Promise<Page> {
  const cached = pages.get(dept.username);
  if (cached) return cached;
  const { context, page } = await openSession(browser, dept, PASSWORD);
  contexts.push(context);
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

const row = (page: Page, label: string) => page.getByRole("row").filter({ hasText: label });
const selectBox = (page: Page, label: string) => page.getByLabel(`${label} masasını seç`);
const bulkBar = (page: Page) => page.getByRole("region", { name: "Toplu işlemler" });

async function clearSelection(page: Page): Promise<void> {
  const clear = page.getByRole("button", { name: "Seçimi temizle" });
  if (await clear.isVisible()) await clear.click();
  await expect(bulkBar(page)).toHaveCount(0);
}

test.afterAll(async () => {
  for (const context of contexts) await context.close();
});

test.describe("Masa sınıflandırma ve tahsis", () => {
  test("yönetici Entertainment ve Casino yöneticilerini, etkinliği ve dört masayı oluşturup yayımlar", async ({ page }) => {
    for (const dept of [ENT, CASINO]) await createManager(page, dept, PASSWORD);
    eventId = await createEvent(page, EVENT_NAME);
    await addTablesAndSave(page, eventId, [
      { label: "A1", capacity: 8 },
      { label: "A2", capacity: 8 },
      { label: "A3", capacity: 6 },
      { label: "A4", capacity: 4 },
    ]);
    await publishEvent(page, eventId);
  });

  test("Entertainment A1'i VIP yapıp 6 sandalyeye indirir, A2 ve A4'ü Premium yapar; değerler yenilemede korunur", async ({
    browser,
  }) => {
    const ent = await sessionFor(browser, ENT);
    await ent.goto(`/events/${eventId}`);
    const nav = ent.getByRole("navigation", { name: "Etkinlik bölümleri" });
    await expect(nav.getByRole("link", { name: "Masalar ve Satış" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Finans" })).toHaveCount(0);
    await nav.getByRole("link", { name: "Masalar ve Satış" }).click();
    await expect(ent.getByRole("heading", { name: "Masalar ve Satış", level: 1 })).toBeVisible();

    // A1: VIP ve satılabilir sandalye 6.
    await ent.getByRole("combobox", { name: "A1 kategorisi" }).click();
    await ent.getByRole("option", { name: "VIP" }).click();
    await expect(ent.getByRole("combobox", { name: "A1 kategorisi" })).toHaveText("VIP");
    const sellable = ent.getByLabel("A1 satılabilir sandalye");
    await sellable.fill("6");
    await sellable.press("Enter");
    await expect(sellable).toBeEnabled();

    // A2 ve A4: toplu "Premium".
    await selectBox(ent, "A2").check();
    await selectBox(ent, "A4").check();
    await expect(bulkBar(ent).getByText("2 masa seçili")).toBeVisible();
    await bulkBar(ent).locator("#bulk-category").click();
    await ent.getByRole("option", { name: "Premium" }).click();
    await bulkBar(ent).getByRole("button", { name: "Kategoriyi uygula" }).click();
    await expect(ent.getByRole("combobox", { name: "A2 kategorisi" })).toHaveText("Premium");
    await expect(ent.getByRole("combobox", { name: "A4 kategorisi" })).toHaveText("Premium");
    await clearSelection(ent);

    await ent.reload();
    await expect(ent.getByRole("combobox", { name: "A1 kategorisi" })).toHaveText("VIP");
    await expect(ent.getByLabel("A1 satılabilir sandalye")).toHaveValue("6");
    await expect(ent.getByRole("combobox", { name: "A2 kategorisi" })).toHaveText("Premium");
    await expect(ent.getByRole("combobox", { name: "A4 kategorisi" })).toHaveText("Premium");
    await expect(ent.getByRole("combobox", { name: "A3 kategorisi" })).toHaveText("Standart");
  });

  test("Casino A3'ü ayırır; Entertainment'ın açık sayfasında A3 yenilemeden Casino olur", async ({ browser }) => {
    const ent = await sessionFor(browser, ENT);
    const casino = await sessionFor(browser, CASINO);
    await ent.goto(`/events/${eventId}/tables`);
    await expect(row(ent, "A3")).toContainText("Beklemede");

    await casino.goto(`/reservations/${eventId}/allocation`);
    await selectBox(casino, "A3").check();
    await casino.getByRole("button", { name: "Casino'ya ayır" }).click();
    await expect(casino.getByRole("status").filter({ hasText: "1 masa Casino'ya ayrıldı" })).toBeVisible();

    // Entertainment sayfayı yenilemez; canlı olay ekranı günceller.
    await expect.poll(async () => (await row(ent, "A3").textContent()) ?? "", { timeout: 10_000 }).toContain("Casino");
  });

  test("Entertainment A1 ve A2'yi satışa açar; yuvalar oluşur; Casino masası satışa açılamaz", async ({ browser }) => {
    const ent = await sessionFor(browser, ENT);
    await ent.goto(`/events/${eventId}/tables`);

    await selectBox(ent, "A1").check();
    await selectBox(ent, "A2").check();
    await bulkBar(ent).getByRole("button", { name: "Satışa aç" }).click();
    await expect(row(ent, "A1")).toContainText("Online satış");
    await expect(row(ent, "A2")).toContainText("Online satış");

    expect(await seatSlotCount(EVENT_NAME, "A1")).toBe(6);
    expect(await seatSlotCount(EVENT_NAME, "A2")).toBe(8);
    expect(await seatSlotCount(EVENT_NAME, "A3")).toBe(0);

    // Casino'ya ayrılmış A3 tek başına seçiliyken "Satışa aç" devre dışıdır ve nedeni görünür.
    await clearSelection(ent);
    await selectBox(ent, "A3").check();
    await expect(bulkBar(ent).getByRole("button", { name: "Satışa aç" })).toBeDisabled();
    await expect(bulkBar(ent).getByText("Casino'ya ayrılmış").first()).toBeVisible();
    await clearSelection(ent);
  });

  test("Casino yalnızca A3'e rezervasyon yapar; kod ayrıntıda ve listede görünür", async ({ browser }) => {
    const casino = await sessionFor(browser, CASINO);
    await casino.goto(`/reservations/${eventId}/new`);
    const options = await casino.getByLabel("Masa", { exact: true }).locator("option").allTextContents();
    const tables = options.filter((text) => !/Masa seçin/.test(text));
    expect(tables).toHaveLength(1);
    expect(tables[0]).toContain("A3");

    await fillReservation(casino, { table: "A3", guests: 2, name: GUEST, phone: "5321110055" });
    await casino.waitForURL(new RegExp(`/reservations/${eventId}/[0-9a-f-]{36}$`));
    const codeCell = casino.locator("dt", { hasText: "Rezervasyon kodu" }).locator("xpath=following-sibling::dd[1]");
    const code = ((await codeCell.textContent()) ?? "").trim();
    expect(code).toMatch(BOOKING_CODE);

    await casino.goto(`/reservations/${eventId}`);
    await expect(casino.getByText(code, { exact: true })).toBeVisible();
  });

  test("rezervasyonlu A3 serbest bırakılamaz; iptalden sonra bırakılır ve Entertainment bildirim alır", async ({
    browser,
  }) => {
    const casino = await sessionFor(browser, CASINO);
    const ent = await sessionFor(browser, ENT);

    await casino.goto(`/reservations/${eventId}/allocation`);
    await expect(selectBox(casino, "A3")).toHaveCount(0);
    await expect(row(casino, "A3")).toContainText("Rezervasyonlu");

    // Rezervasyonu iptal et.
    await casino.goto(`/reservations/${eventId}`);
    await casino.getByRole("link", { name: new RegExp(GUEST) }).first().click();
    // Yük altında sayfa hidrasyonu bitmeden açılan onay penceresi yeniden çizilip kapanabilir; açma+onay birlikte denenir.
    const dialog = casino.getByRole("alertdialog");
    await expect(async () => {
      if (!(await dialog.isVisible())) await casino.getByRole("button", { name: "İptal et" }).click({ timeout: 3_000 });
      await dialog.getByRole("button", { name: "İptal et" }).click({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await expect(casino.getByText("İptal edildi", { exact: true })).toBeVisible();

    const entBefore = await unread(ent);

    await casino.goto(`/reservations/${eventId}/allocation`);
    await selectBox(casino, "A3").check();
    await casino.getByRole("button", { name: "Serbest bırak" }).click();
    await casino.getByRole("alertdialog").getByRole("button", { name: "Serbest bırak" }).click();
    await expect(casino.getByRole("status").filter({ hasText: "1 masa serbest bırakıldı" })).toBeVisible();

    expect(await tableAllocation(EVENT_NAME, "A3")).toBe("pending");
    await expect.poll(() => unread(ent)).toBe(entBefore + 1);

    // Bildirimdeki bağlantı "Masalar ve Satış" ekranına götürür.
    await ent.getByRole("link", { name: "Ayrıntıya git" }).first().click();
    await ent.waitForURL(new RegExp(`/events/${eventId}/tables$`));
    await expect(ent.getByRole("heading", { name: "Masalar ve Satış", level: 1 })).toBeVisible();
  });

  test("Entertainment satış kurallarında tutma süresini 15 yapar; yenilemede korunur", async ({ browser }) => {
    const ent = await sessionFor(browser, ENT);
    await ent.goto(`/events/${eventId}/tables`);
    await ent.getByLabel("Tutma süresi (dk)").fill("15");
    await ent.getByRole("button", { name: "Kuralları kaydet" }).click();
    await expect(ent.getByText("Satış kuralları kaydedildi")).toBeVisible();

    await ent.reload();
    await expect(ent.getByLabel("Tutma süresi (dk)")).toHaveValue("15");
  });

  test("yetkisiz departmanlar karşı tarafın ekranında 403 sayfası görür", async ({ browser }) => {
    const casino = await sessionFor(browser, CASINO);
    const ent = await sessionFor(browser, ENT);
    const denied = "Bu sayfaya erişim yetkiniz yok";

    await casino.goto(`/events/${eventId}/tables`);
    await expect(casino.getByRole("heading", { name: denied })).toBeVisible();

    await ent.goto(`/reservations/${eventId}/allocation`);
    await expect(ent.getByRole("heading", { name: denied })).toBeVisible();
  });
});
