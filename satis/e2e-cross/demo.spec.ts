import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { continueToPayment, openSeatPicker, payDemo, ticketSeats } from "./support/buyer";
import { buyViaApi, coreContext, salesApi, warmCore } from "./support/core";
import { crossState } from "./support/state";

test.describe.configure({ mode: "serial" });
test.use({ extraHTTPHeaders: { "x-real-ip": "10.66.0.4" } });

async function readReportsSummary(page: Page): Promise<string> {
  const totals = page.locator("section[aria-labelledby='period-totals']");
  if ((await totals.count()) > 0) {
    return (await totals.innerText()).trim();
  }
  return (await page.getByText("Bu dönemde arşivlenmiş etkinlik yok.").innerText()).trim();
}

test.beforeAll(async ({ request }) => {
  test.setTimeout(240_000);
  const { events } = crossState();
  await warmCore(
    request,
    Object.values(events).map((e) => e.id),
  );
});

test.afterAll(async ({ browser }) => {
  const ctx = await coreContext(browser, "admin");
  try {
    const page = await ctx.newPage();
    await page.goto("/admin/settings");
    await page.getByRole("tab", { name: "Satış sitesi" }).click();
    const toggle = page.getByRole("switch", { name: "Satış sitesi demo aktif" });
    if (await toggle.isChecked()) {
      await toggle.click();
      await expect(page.getByText("Demo modu kapatıldı")).toBeVisible();
    }
  } finally {
    await ctx.close();
  }
});

test("demo anahtarı: açıkken yalnız demo konserler, kapalıyken yalnız gerçek etkinlikler; eski siparişler çalışmaya devam eder", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(300_000);
  const { events } = crossState();
  const gala = events.gala;
  const t5 = gala.tables.find((t) => t.label === "T5")!;
  const t6 = gala.tables.find((t) => t.label === "T6")!;
  const api = salesApi(request);

  let realToken = "";
  let realPnr = "";
  let reportsBefore = "";
  let demoEventId = "";
  let demoEventName = "";
  let demoToken = "";
  let demoPnr = "";

  const adminCtx = await coreContext(browser, "admin");
  const adminPage = await adminCtx.newPage();

  try {
    await test.step("ön koşul: gerçek ön sipariş API ile alınır", async () => {
      const order = await buyViaApi(request, {
        eventId: gala.id,
        tableId: t6.id,
        quantity: 2,
        ip: "10.66.0.4",
        buyer: { firstName: "Mehmet", lastName: "Demir", email: "mehmet@example.com" },
      });
      realToken = order.orderToken;
      realPnr = order.pnr;
    });

    await test.step("site '/' gerçek etkinlikleri DEMO rozeti olmadan gösterir", async () => {
      await page.goto("/");
      await expect(page.getByRole("article").filter({ hasText: events.koltuk.name })).toBeVisible();
      await expect(page.getByRole("article").getByText("DEMO", { exact: true })).toHaveCount(0);
    });

    await test.step("çekirdek /reports özeti kaydedilir", async () => {
      await adminPage.goto("/reports");
      await expect(adminPage.getByRole("heading", { name: "Raporlar", level: 1 })).toBeVisible();
      reportsBefore = await readReportsSummary(adminPage);
    });

    await test.step("/admin/settings üzerinden demo anahtarı açılır", async () => {
      await adminPage.goto("/admin/settings");
      await adminPage.getByRole("tab", { name: "Satış sitesi" }).click();
      const toggle = adminPage.getByRole("switch", { name: "Satış sitesi demo aktif" });
      await expect(toggle).toBeVisible();
      if (!(await toggle.isChecked())) {
        await toggle.click();
        await expect(adminPage.getByText("Demo modu açıldı")).toBeVisible();
      }
      await expect(toggle).toBeChecked();
    });

    await test.step("site '/' 45 sn içinde yalnız DEMO kartlarını gösterir ve API isDemo döner", async () => {
      await expect
        .poll(
          async () => {
            await page.goto("/");
            const realCount = await page.getByRole("article").filter({ hasText: events.koltuk.name }).count();
            const cards = page.getByRole("article");
            const cardCount = await cards.count();
            const demoCount = await cards.filter({ has: page.getByText("DEMO", { exact: true }) }).count();
            return realCount === 0 && cardCount > 0 && demoCount === cardCount;
          },
          { timeout: 45_000, intervals: [2_000] },
        )
        .toBe(true);

      const listRes = await api.get("events");
      expect(listRes.status()).toBe(200);
      const list = (await listRes.json()) as { events: { isDemo: boolean }[] };
      expect(list.events.length).toBeGreaterThan(0);
      expect(list.events.every((e) => e.isDemo)).toBe(true);
    });

    await test.step("gizli gerçek etkinliğe yeni tutma çekirdekte reddedilir", async () => {
      const res = await api.post(
        "orders",
        {
          eventId: gala.id,
          clientKey: randomUUID(),
          items: [{ tableId: t5.id, quantity: 2 }],
        },
        "10.66.0.4",
      );
      expect(res.status()).toBe(404);
      expect((await res.json()).error.code).toBe("event_not_found");
    });

    await test.step("eski gerçek siparişin bilet sayfası 2 QR ile açılır", async () => {
      await page.goto(`/bilet/${realToken}`);
      await expect(page.getByRole("img", { name: /Bilet \d+ QR kodu/ })).toHaveCount(2);
    });

    await test.step("demo açıkken gerçek etkinliğin check-in ekranında realPnr içeri alınır", async () => {
      await adminPage.goto(`/check-in/${gala.id}`);
      await expect(adminPage.getByRole("heading", { name: gala.name, level: 1 })).toBeVisible();
      await adminPage.getByRole("tablist", { name: "Check-in bölümleri" }).getByRole("tab", { name: "Ara", exact: true }).click();
      await adminPage.locator("#guest-search").fill(realPnr);
      const order = adminPage.getByRole("region", { name: "Sipariş" });
      await expect(order).toBeVisible();
      await order.getByRole("button", { name: /Seçilenleri içeri al/ }).click();
      await expect(adminPage.getByRole("status").filter({ hasText: "2 bilet içeri alındı" })).toBeVisible();
    });

    await test.step("ilk demo etkinlikten 2 sandalye seçilip demo ödeme tamamlanır", async () => {
      await page.goto("/");
      const firstCard = page.getByRole("article").filter({ has: page.getByText("DEMO", { exact: true }) }).first();
      demoEventName = (await firstCard.getByRole("heading").textContent())!.trim();
      await firstCard.getByRole("link", { name: "Bilet Al" }).click();
      await expect(page).toHaveURL(/\/etkinlik\/[0-9a-f-]+(?:#bilet-al)?$/);
      const match = /\/etkinlik\/([0-9a-f-]+)/.exec(page.url());
      if (!match?.[1]) throw new Error(`Demo etkinlik kimliği URL'den okunamadı: ${page.url()}`);
      demoEventId = match[1];

      await openSeatPicker(page, demoEventId, 2);
      const finder = page.getByRole("region", { name: "Masa bulucu" });
      const firstSeatTable = finder
        .getByRole("list", { name: "Alınabilir masalar" })
        .getByRole("button", { name: /^Masa .*boş/ })
        .first();
      const activeCard = page.getByRole("region", { name: "Seçili masa" });
      const freeSeatButtons = activeCard.getByRole("button", { name: /^Sandalye \d+, boş$/ });
      await expect(async () => {
        await firstSeatTable.click();
        await expect(freeSeatButtons.first()).toBeVisible({ timeout: 2000 });
      }).toPass();
      await freeSeatButtons.first().click();
      await freeSeatButtons.first().click();

      await continueToPayment(page);
      const paid = await payDemo(page, { firstName: "Zeynep", lastName: "Arslan", email: "zeynep@example.com" });
      demoPnr = paid.pnr;
      demoToken = paid.ticketUrl.split("/bilet/")[1]!.split(/[?#]/)[0]!;

      await expect(page.getByText("DEMO - gerçek ödeme alınmadı")).toBeVisible();
      const seats = await ticketSeats(page);
      expect(seats).toHaveLength(2);
      expect(seats.every((s) => s.seatNo !== null)).toBe(true);
    });

    await test.step("çekirdek /sales-site DEMO AKTİF bandını ve demo siparişi gösterir", async () => {
      await adminPage.goto("/sales-site");
      await expect(adminPage.getByRole("status").filter({ hasText: "DEMO AKTİF" })).toBeVisible();
      await adminPage.goto(`/sales-site/${demoEventId}?tab=siparisler`);
      await expect(adminPage.getByRole("link", { name: demoPnr })).toBeVisible();
    });

    await test.step("çekirdek /reports özeti değişmez ve demo konser adı raporda geçmez", async () => {
      await adminPage.goto("/reports");
      await expect(adminPage.getByRole("heading", { name: "Raporlar", level: 1 })).toBeVisible();
      const reportsAfter = await readReportsSummary(adminPage);
      expect(reportsAfter).toBe(reportsBefore);
      await expect(adminPage.getByText(demoEventName)).toHaveCount(0);
    });

    await test.step("demo anahtarı kapatılır ve site gerçek etkinliklere döner", async () => {
      await adminPage.goto("/admin/settings");
      await adminPage.getByRole("tab", { name: "Satış sitesi" }).click();
      const toggle = adminPage.getByRole("switch", { name: "Satış sitesi demo aktif" });
      await toggle.click();
      await expect(adminPage.getByText("Demo modu kapatıldı")).toBeVisible();
      await expect(toggle).not.toBeChecked();

      await expect
        .poll(
          async () => {
            await page.goto("/");
            const realVisible = await page.getByRole("article").filter({ hasText: events.koltuk.name }).isVisible();
            const demoCount = await page.getByRole("article").getByText("DEMO", { exact: true }).count();
            return realVisible && demoCount === 0;
          },
          { timeout: 45_000, intervals: [2_000] },
        )
        .toBe(true);

      const listRes = await api.get("events");
      expect(listRes.status()).toBe(200);
      const list = (await listRes.json()) as { events: { isDemo: boolean }[] };
      expect(list.events.length).toBeGreaterThan(0);
      expect(list.events.every((e) => !e.isDemo)).toBe(true);
    });

    await test.step("kapatma sonrası demo bileti ve /biletimi-bul çalışmaya devam eder", async () => {
      await page.goto(`/bilet/${demoToken}`);
      await expect(page.getByRole("img", { name: /Bilet \d+ QR kodu/ })).toHaveCount(2);

      await page.goto("/biletimi-bul");
      await page.getByLabel("PNR").fill(demoPnr);
      await page.getByLabel("Soyad").fill("Arslan");
      await page.getByRole("button", { name: "Biletimi bul" }).click();
      await expect(page).toHaveURL(new RegExp(`/bilet/${demoToken}`));
    });

    await test.step("kapatma sonrası demo etkinliğin check-in ekranında demoPnr içeri alınır", async () => {
      await adminPage.goto(`/check-in/${demoEventId}`);
      await adminPage.getByRole("tablist", { name: "Check-in bölümleri" }).getByRole("tab", { name: "Ara", exact: true }).click();
      await adminPage.locator("#guest-search").fill(demoPnr);
      const order = adminPage.getByRole("region", { name: "Sipariş" });
      await expect(order).toBeVisible();
      await order.getByRole("button", { name: /Seçilenleri içeri al/ }).click();
      await expect(adminPage.getByRole("status").filter({ hasText: "2 bilet içeri alındı" })).toBeVisible();
    });
  } finally {
    await adminCtx.close();
  }
});
