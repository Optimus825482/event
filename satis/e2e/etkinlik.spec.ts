import { expect, test } from "@playwright/test";
import { expectHeadingOrder } from "./sayfa-yardimcilari";
import { fakeRequests, fakeState } from "./support/fake";
import { expectNoHorizontalOverflow } from "./support/layout";
import { CONTACT } from "../src/content/site";
import { formatEventDay } from "../src/lib/time-zone";

const { gala, kapali, masa } = fakeState().events;

test("etkinlik sayfası: görsel, tarih, kapı ve konser saati, yaş sınırı, tanıtım; Kıyafet yerine Bilet Al", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}`);
  await expect(page.getByRole("heading", { level: 1, name: gala.name })).toBeVisible();
  for (const text of ["Kapı Açılış", "Konser Saati", "18+", "Yılbaşı gecesine özel gala.", "Demo Sanatçı"]) {
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText("Kıyafet", { exact: true })).toHaveCount(0);
  await expect(page.locator("main dl").getByRole("link", { name: "Bilet Al" })).toBeVisible();
  // Masa seçimi artık ayrı sayfadadır.
  await expect(page.locator("section#masa-secimi")).toHaveCount(0);
  await expect(page.getByTestId("plan-3d-scene")).toHaveCount(0);
  const img = page.locator('main img[src^="/api/gorsel/"]').first();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await expectHeadingOrder(page);
  await expectNoHorizontalOverflow(page);
});

const eyebrow = (e: typeof gala) => `${e.artistName ?? e.name} · ${formatEventDay(e.startsAt)}`.toLocaleUpperCase("tr-TR");

test("Bilet Al penceresi kişi sayısını sorar ve masa seçimine götürür", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}#bilet-al`);
  const dialog = page.getByRole("dialog", { name: "Kişi sayısı" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog.getByText(eyebrow(gala), { exact: true })).toBeVisible();
  await expect(dialog.getByRole("heading", { level: 2, name: "Kişi sayısı" })).toBeVisible();
  await expect(
    dialog.getByText("Kişi sayısına uygun masalar gösterilir. Müsait localar bütün olarak rezerve edilir."),
  ).toBeVisible();
  await expect(page.getByText("Kaç kişisiniz?")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Masaları göster" })).toHaveCount(0);
  const select = dialog.getByRole("combobox", { name: "Kişi sayısı" });
  await expect(select).toBeFocused();
  await expect(select.locator("option")).toHaveCount(Math.min(12, gala.sale.maxSeatsPerOrder));
  await expect(select).toHaveValue("2");
  await expect(select.locator("option:checked")).toHaveText("2 kişi");
  await select.selectOption("4");
  await dialog.getByRole("button", { name: "Masa seçimine geç →" }).click();
  await expect(page).toHaveURL(`/etkinlik/${gala.id}/salon?kisi=4`);
  await expect(page.getByRole("heading", { level: 1, name: gala.name })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Bilet seçimi" }).getByLabel("Kişi sayısı")).toHaveValue("4");

  // Salondan detaya dönülür; bilgi ızgarasındaki Bilet Al aynı pencereyi açar; Esc kapatır ve odak düğmeye döner.
  await page.getByRole("link", { name: "← Etkinlik detayı" }).click();
  await expect(page).toHaveURL(`/etkinlik/${gala.id}`);
  const trigger = page.getByRole("main").getByRole("link", { name: "Bilet Al" });
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "Kişi sayısı" })).toHaveValue("2");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("pencere kipli: odak pencerede kalır, kapat düğmesi kapatır", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}`);
  await page.getByRole("main").getByRole("link", { name: "Bilet Al" }).click();
  const dialog = page.getByRole("dialog", { name: "Kişi sayısı" });
  await expect(dialog).toBeVisible();
  // showModal: üst katmanda, sayfanın geri kalanı etkisiz (odak dışarı çıkamaz).
  expect(await dialog.evaluate((el) => el.matches(":modal"))).toBe(true);
  await page.keyboard.press("Tab");
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await dialog.getByRole("button", { name: "Pencereyi kapat" }).click();
  await expect(dialog).toBeHidden();
});

test("üst menüdeki Bilet Al etkinlik sayfasında pencereyi açar, başka sayfada etkinliklere gider", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/etkinlik/${gala.id}`);
  await page.locator('[data-nav="desktop"]').getByRole("link", { name: "Bilet Al" }).click();
  await expect(page.getByRole("dialog", { name: "Kişi sayısı" })).toBeVisible();
  await expect(page).toHaveURL(`/etkinlik/${gala.id}`);

  await page.goto("/takvim");
  await page.locator('[data-nav="desktop"]').getByRole("link", { name: "Bilet Al" }).click();
  await expect(page).toHaveURL("/etkinlikler");
});

test("kişi sayısı penceresi JavaScript kapalıyken de çalışır", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  await page.goto(`/etkinlik/${gala.id}`);
  const dialog = page.locator("dialog#bilet-al");
  await expect(dialog).toBeHidden();
  await page.getByRole("main").getByRole("link", { name: "Bilet Al" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("combobox", { name: "Kişi sayısı" }).selectOption("3");
  await dialog.getByRole("button", { name: "Masa seçimine geç →" }).click();
  await expect(page).toHaveURL(`/etkinlik/${gala.id}/salon?kisi=3`);
  await expect(page.getByRole("heading", { level: 1, name: gala.name })).toBeVisible();
  await context.close();
});

test.describe("kisi parametresi", () => {
  for (const raw of ["99", "0", "abc", "2.5", ""]) {
    test(`detayda geçersiz değer (${raw || "boş"}) sayfayı bozmaz, salona yönlendirmez`, async ({ page }) => {
      expect((await page.goto(`/etkinlik/${gala.id}?kisi=${raw}`))!.status()).toBe(200);
      await expect(page).toHaveURL(`/etkinlik/${gala.id}?kisi=${raw}`);
      await expect(page.locator("dialog#bilet-al").getByRole("combobox", { includeHidden: true })).toHaveValue("2");
    });
    test(`salonda geçersiz değer (${raw || "boş"}) kişi sayısı penceresine döner`, async ({ page }) => {
      await page.goto(`/etkinlik/${gala.id}/salon?kisi=${raw}`);
      await expect(page).toHaveURL(`/etkinlik/${gala.id}#bilet-al`);
      await expect(page.getByRole("dialog", { name: "Kişi sayısı" })).toBeVisible();
    });
  }

  test("eski bağlantı (?kisi=n#masa-secimi) salon sayfasına yönlenir", async ({ page }) => {
    await page.goto(`/etkinlik/${gala.id}?kisi=3#masa-secimi`);
    await expect(page).toHaveURL(new RegExp(`/etkinlik/${gala.id}/salon\\?kisi=3`));
    await expect(page.getByRole("complementary", { name: "Bilet seçimi" }).getByLabel("Kişi sayısı")).toHaveValue("3");
  });
});

test("salon sayfası: başlık, detaya dönüş, planı çizer ve satış şeklini yazar", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}/salon?kisi=2`);
  await expect(page.getByRole("heading", { level: 1, name: gala.name })).toBeVisible();
  await expect(page.getByRole("link", { name: "← Etkinlik detayı" })).toHaveAttribute("href", `/etkinlik/${gala.id}`);
  await expect(page.locator("section#masa-secimi").getByText(/A1/).first()).toBeVisible();
  await expect(
    page.getByText("Sandalye bazlı satış: salondan masanızı ve numaralı sandalyelerinizi seçersiniz."),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Seçiminiz" }).getByText("0/2 kişi seçildi")).toBeVisible();
  await expectHeadingOrder(page);
});

test("masa bazlı etkinlikte açıklama masa bazlıdır", async ({ page }) => {
  await page.goto(`/etkinlik/${masa.id}/salon?kisi=2`);
  await expect(page.getByText("Masa bazlı satış: masalar bütün olarak satılır.")).toBeVisible();
});

test("satışı kapalı etkinlikte durum yazılır, kişi sayısı penceresi yoktur; salon gezilebilir", async ({ page }) => {
  await page.goto(`/etkinlik/${kapali.id}#bilet-al`);
  await expect(page.getByText("Satış kapalı")).toBeVisible();
  await expect(page.locator("dialog#bilet-al")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("link", { name: "Bilet Al" })).toHaveCount(0);
  await page.getByRole("link", { name: "Salonu ve sahne görüşünü incele →" }).click();
  await expect(page).toHaveURL(`/etkinlik/${kapali.id}/salon`);
  await expect(page.locator("section#masa-secimi")).toBeVisible();
  await expect(page.getByRole("region", { name: "Sahne görüşü" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Seçiminiz" })).toHaveCount(0);
});

test("Konum: Google Haritalar gömülü harita, mekân adresi, yol tarifi ve haritada aç", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}`);
  const section = page.locator("section", { has: page.getByRole("heading", { level: 2, name: "Konum" }) });
  const query = encodeURIComponent(`${CONTACT.venue}, ${CONTACT.address}`);
  const frame = section.locator("iframe");
  await expect(frame).toHaveAttribute("src", `https://www.google.com/maps?q=${query}&output=embed`);
  await expect(frame).toHaveAttribute("title", `${CONTACT.venue} haritası`);
  await expect(frame).toHaveAttribute("loading", "lazy");
  await expect(section.getByText(CONTACT.venue, { exact: true })).toBeVisible();
  await expect(section.getByText(CONTACT.address, { exact: true })).toBeVisible();
  const directions = section.getByRole("link", { name: "Yol tarifi al" });
  await expect(directions).toHaveAttribute("href", `https://www.google.com/maps/dir/?api=1&destination=${query}`);
  await expect(directions).toHaveAttribute("target", "_blank");
  await expect(directions).toHaveAttribute("rel", "noopener noreferrer");
  const open = section.getByRole("link", { name: "Google Haritalar'da aç" });
  await expect(open).toHaveAttribute("href", `https://www.google.com/maps/search/?api=1&query=${query}`);
  await expect(open).toHaveAttribute("rel", "noopener noreferrer");
  const csp = (await page.request.get(`/etkinlik/${gala.id}`)).headers()["content-security-policy"] ?? "";
  expect(csp).toContain("frame-src https://www.google.com");
  await expectNoHorizontalOverflow(page);
});

test("bilinmeyen etkinlik 404 verir ve çekirdeğe doluluk isteği gitmez", async ({ page }) => {
  const before = (await fakeRequests()).filter((r) => r.path.endsWith("/availability")).length;
  const res = await page.goto(`/etkinlik/${crypto.randomUUID()}`);
  expect(res!.status()).toBe(404);
  expect((await page.goto(`/etkinlik/${crypto.randomUUID()}/salon?kisi=2`))!.status()).toBe(404);
  expect((await fakeRequests()).filter((r) => r.path.endsWith("/availability")).length).toBe(before);
});
