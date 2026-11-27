import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { continueToPayment, openSeatPicker, payDemo, pickSeats, ticketSeats } from "./support/buyer";
import { salesApi, warmCore } from "./support/core";
import { crossState } from "./support/state";

// Çekirdek `next dev` ile ilk istekte uçları derler; satış sitesinin zaman aşımına takılmasın diye önceden ısıtılır.
test.beforeAll(async ({ request }) => {
  test.setTimeout(240_000);
  const { events } = crossState();
  await warmCore(
    request,
    Object.values(events).map((e) => e.id),
  );
});

// Aynı IP'den en çok 5 tutma ve 4 arama yapılır; çekirdek hız sınırlarının altında kalınır.
test("gerçek çekirdekle: masa seç → tut → demo öde → e-bilet → planda düş → biletimi bul", async ({ page, browser }) => {
  const { events, coreUrl } = crossState();
  const gala = events.gala;
  const coreRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().startsWith(coreUrl)) coreRequests.push(r.url());
  });

  await page.goto("/");
  await page.getByRole("article").filter({ hasText: gala.name }).getByRole("link", { name: "Bilet Al" }).click();
  await expect(page).toHaveURL(new RegExp(`/etkinlik/${gala.id}`));
  await page.getByRole("button", { name: "Masa Seçimine Geç →" }).click();
  await expect(page).toHaveURL(new RegExp(`/etkinlik/${gala.id}\\?kisi=2#masa-secimi`));
  await expect(page.locator("section#masa-secimi")).toBeVisible();

  const watcher = await (await browser.newContext({ viewport: { width: 375, height: 812 } })).newPage(); // ikinci ziyaretçi
  await openSeatPicker(watcher, gala.id, 2);
  await expect(watcher.getByRole("button", { name: /Masa T3 · Standart · boş 8\/8/ })).toBeVisible();

  await pickSeats(page, "T3", [1, 2]);
  const panel = page.getByRole("region", { name: "Seçiminiz" });
  await expect(panel.getByText("3.000,00 ₺")).toBeVisible();
  await continueToPayment(page);
  await expect(watcher.getByRole("button", { name: /Masa T3 · Standart · boş 6\/8/ })).toBeVisible({ timeout: 12_000 }); // tutma canlı görünür

  const { pnr, ticketUrl } = await payDemo(
    page,
    { firstName: "Ayşe", lastName: "Kaya", email: "ayse@example.com" },
    { testDecline: true },
  );

  await expect(page.getByText("DEMO - gerçek ödeme alınmadı")).toBeVisible();
  await expect(page.getByRole("img", { name: /Bilet \d+ QR kodu/ })).toHaveCount(2);
  const seats = await ticketSeats(page);
  expect(seats).toHaveLength(2);
  expect(seats.every((s) => s.table === "T3")).toBe(true);

  await page.goto("/biletimi-bul");
  await page.getByLabel("PNR").fill(pnr);
  await page.getByLabel("Soyad").fill("Yılmaz");
  await page.getByRole("button", { name: "Biletimi bul" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /^PNR ya da soyad hatalı.$/ })).toBeVisible();
  await page.getByLabel("Soyad").fill("kaya");
  await page.getByRole("button", { name: "Biletimi bul" }).click();
  await expect(page).toHaveURL(ticketUrl);

  await watcher.reload();
  await expect(watcher.getByRole("button", { name: /Masa T3 · Standart · boş 6\/8/ })).toBeVisible(); // satış kalıcı
  expect(coreRequests).toEqual([]); // tarayıcı çekirdeğe gitmedi
});

test("gerçek çekirdekle: tek sandalye bırakan adet çekirdekte de reddedilir, masanın tamamı alınır", async ({ page, request }) => {
  const { events } = crossState();
  const gala = events.gala;
  const t4 = gala.tables.find((t) => t.label === "T4")!;

  await openSeatPicker(page, gala.id, 8);

  // Doğrudan çekirdek: 7'lik tutma tek sandalye bırakır → 409 leaves_single_seat.
  const res = await salesApi(request).post("orders", {
    eventId: gala.id,
    items: [{ tableId: t4.id, quantity: 7 }],
    clientKey: randomUUID(),
  });
  expect(res.status()).toBe(409);
  expect((await res.json()).error.code).toBe("leaves_single_seat");

  // Arayüzden T4'ün 8 sandalyesi ödeme adımına gider.
  await pickSeats(page, "T4", [1, 2, 3, 4, 5, 6, 7, 8]);
  await continueToPayment(page);
  await expect(page.getByText(/Masa T4 · .* · 8 ×/)).toBeVisible();
});

test("gerçek çekirdekle: sırsız istek 401 döner", async ({ request }) => {
  const res = await request.get(`${crossState().coreUrl}/api/sales/v1/events`);
  expect(res.status()).toBe(401);
});
