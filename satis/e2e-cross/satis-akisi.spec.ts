import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { crossState } from "./support/state";

// Çekirdek `next dev` ile ilk istekte uçları derler; satış sitesinin zaman aşımına takılmasın diye önceden ısıtılır.
test.beforeAll(async ({ request }) => {
  test.setTimeout(240_000);
  const { eventId, coreUrl } = crossState();
  for (const path of ["events", `events/${eventId}`, `events/${eventId}/availability`]) {
    await expect
      .poll(async () => (await request.get(`${coreUrl}/api/sales/v1/${path}`, { headers: { authorization: `Bearer ${process.env.CROSS_SECRET}` } })).status(), { timeout: 100_000 })
      .toBe(200);
  }
});

// Aynı IP'den en çok 5 tutma ve 4 arama yapılır; çekirdek hız sınırlarının altında kalınır.
test("gerçek çekirdekle: masa seç → tut → demo öde → e-bilet → planda düş → biletimi bul", async ({ page, browser }) => {
  const { eventId, coreUrl } = crossState();
  const coreRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().startsWith(coreUrl)) coreRequests.push(r.url());
  });

  await page.goto("/");
  await page.getByRole("article").filter({ hasText: "Çapraz Test Gecesi" }).getByRole("link", { name: "Masa seç" }).click();
  await expect(page).toHaveURL(`/etkinlik/${eventId}`);
  await expect(page.getByRole("button", { name: "Masa T3, Standart, boş sandalye 8/8" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Masa C1, satışta değil" })).toBeVisible();

  const watcher = await (await browser.newContext({ viewport: { width: 375, height: 812 } })).newPage(); // ikinci ziyaretçi
  await watcher.goto(`/etkinlik/${eventId}`);

  await page.getByRole("button", { name: /Masa T3,/ }).click();
  const panel = page.getByRole("region", { name: "Seçiminiz" });
  await panel.getByRole("button", { name: "Adedi artır" }).click();
  await expect(panel.getByText("3.000,00 ₺")).toBeVisible();
  await panel.getByRole("button", { name: "Devam et" }).click();
  await expect(page).toHaveURL(/\/odeme\//);
  await expect(watcher.getByRole("button", { name: "Masa T3, Standart, boş sandalye 6/8" })).toBeVisible({ timeout: 12_000 }); // tutma canlı görünür

  await expect(page.getByText(/Kalan süre 0\d:\d{2}/)).toBeVisible();
  await expect(page.getByText("DEMO - gerçek ödeme alınmadı")).toBeVisible();
  await page.getByLabel("Ad", { exact: true }).fill("Ayşe");
  await page.getByLabel("Soyad").fill("Kaya");
  await page.getByLabel("E-posta").fill("ayse@example.com");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Reddet (deneme)" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Ödeme reddedildi" })).toBeVisible(); // dev ortamında Next rota duyurucusu da alert rolündedir
  await page.getByRole("button", { name: "Öde" }).click();
  await expect(page).toHaveURL(/\/bilet\//);

  const pnrText = (await page.getByText(/PNR [2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}/).textContent())!;
  const pnr = pnrText.replace("PNR ", "");
  await expect(page.getByText("DEMO - gerçek ödeme alınmadı")).toBeVisible();
  await expect(page.getByRole("img", { name: /Bilet \d QR kodu/ })).toHaveCount(2);
  await expect(page.getByText("Masa T3")).toHaveCount(2);
  const ticketUrl = page.url();

  await page.goto("/biletimi-bul");
  await page.getByLabel("PNR").fill(pnr);
  await page.getByLabel("Soyad").fill("Yılmaz");
  await page.getByRole("button", { name: "Biletimi bul" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /^PNR ya da soyad hatalı.$/ })).toBeVisible();
  await page.getByLabel("Soyad").fill("kaya");
  await page.getByRole("button", { name: "Biletimi bul" }).click();
  await expect(page).toHaveURL(ticketUrl);

  await watcher.reload();
  await expect(watcher.getByRole("button", { name: "Masa T3, Standart, boş sandalye 6/8" })).toBeVisible(); // satış kalıcı
  expect(coreRequests).toEqual([]); // tarayıcı çekirdeğe gitmedi
});

test("gerçek çekirdekle: tek sandalye bırakan adet çekirdekte de reddedilir, masanın tamamı alınır", async ({ page, request }) => {
  const { eventId, tables, coreUrl } = crossState();
  const t4 = tables.find((t) => t.label === "T4")!;

  await page.goto(`/etkinlik/${eventId}`);
  await page.getByRole("button", { name: /Masa T4,/ }).click();
  const panel = page.getByRole("region", { name: "Seçiminiz" });
  // Seçenekler 1–6 ve 8: panel 7'yi sunmaz (tek sandalye kalırdı).

  // Doğrudan çekirdek: 7'lik tutma tek sandalye bırakır → 409 leaves_single_seat.
  const res = await request.post(`${coreUrl}/api/sales/v1/orders`, {
    headers: { authorization: `Bearer ${process.env.CROSS_SECRET}` },
    data: { eventId, items: [{ tableId: t4.id, quantity: 7 }], clientKey: randomUUID() },
  });
  expect(res.status()).toBe(409);
  expect((await res.json()).error.code).toBe("leaves_single_seat");

  // Arayüzden masanın tamamı (8) alınır: 1→2…6→8 altı tıklama.
  for (let i = 0; i < 6; i++) await panel.getByRole("button", { name: "Adedi artır" }).click();
  await expect(panel.getByRole("button", { name: "Adedi artır" })).toBeDisabled();
  await panel.getByRole("button", { name: "Devam et" }).click();
  await expect(page).toHaveURL(/\/odeme\//);
  await expect(page.getByText(/Masa T4 · .* · 8 ×/)).toBeVisible();
});

test("gerçek çekirdekle: sırsız istek 401 döner", async ({ request }) => {
  const res = await request.get(`${crossState().coreUrl}/api/sales/v1/events`);
  expect(res.status()).toBe(401);
});
