import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { continueToPayment, openSeatPicker, payDemo, pickSeats, ticketSeats } from "./support/buyer";
import { buyViaApi, coreContext, salesApi, warmCore } from "./support/core";
import { crossState } from "./support/state";

test.use({ extraHTTPHeaders: { "x-real-ip": "10.66.0.2" } });

function sortSeats(seats: readonly { table: string; seatNo: number | null }[]) {
  return [...seats].sort((a, b) => a.table.localeCompare(b.table) || (a.seatNo ?? 0) - (b.seatNo ?? 0));
}

test.beforeAll(async ({ request }) => {
  test.setTimeout(240_000);
  await warmCore(request, [crossState().events.koltuk.id]);
});

test("sandalye bazlı: iki masadan numaralı sandalye seç → öde → bilette ve çekirdek sipariş ekranında aynı numaralar", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(180_000);
  const { events } = crossState();
  const koltuk = events.koltuk;
  const t1 = koltuk.tables.find((t) => t.label === "T1")!;
  const t2 = koltuk.tables.find((t) => t.label === "T2")!;
  const api = salesApi(request);

  await openSeatPicker(page, koltuk.id, 4);
  await pickSeats(page, "T1", [3, 4]);
  await pickSeats(page, "T2", [5, 6]);
  await continueToPayment(page);

  const { pnr } = await payDemo(page, { firstName: "Ayşe", lastName: "Kaya", email: "ayse@example.com" });
  const expected = [
    { table: "T1", seatNo: 3 },
    { table: "T1", seatNo: 4 },
    { table: "T2", seatNo: 5 },
    { table: "T2", seatNo: 6 },
  ];
  expect(sortSeats(await ticketSeats(page))).toEqual(expected);

  const av = (await (await api.get(`events/${koltuk.id}/availability`)).json()) as {
    tables: { id: string; freeSeats: number[] }[];
  };
  expect(av.tables.find((t) => t.id === t1.id)?.freeSeats).toEqual([1, 2, 5, 6, 7, 8]);
  expect(av.tables.find((t) => t.id === t2.id)?.freeSeats).toEqual([1, 2, 3, 4, 7, 8]);

  const adminCtx = await coreContext(browser, "admin");
  try {
    const adminPage = await adminCtx.newPage();
    await adminPage.goto(`/events/${koltuk.id}/orders`);
    await adminPage.getByRole("link", { name: pnr }).click();
    await expect(adminPage).toHaveURL(new RegExp(`/events/${koltuk.id}/orders/`));
    await expect(adminPage.getByText("DEMO - gerçek ödeme alınmadı")).toBeVisible();
    for (const s of expected) {
      await expect(adminPage.getByText(`Masa ${s.table} · Sandalye ${s.seatNo}`, { exact: true })).toBeVisible();
    }
  } finally {
    await adminCtx.close();
  }
});

test("sandalye bazlı: kişi sayısı dolunca yeni sandalye eklenmez", async ({ page }) => {
  const { events } = crossState();
  const koltuk = events.koltuk;

  await openSeatPicker(page, koltuk.id, 2);
  await pickSeats(page, "T3", [1, 2]);

  const activeCard = page.getByRole("region", { name: "Seçili masa" });
  const thirdSeat = activeCard.getByRole("button", { name: "Sandalye 3, boş" });
  await thirdSeat.click();

  await expect(thirdSeat).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("region", { name: "Seçiminiz" }).getByText("2/2 kişi seçildi")).toBeVisible();
  await expect(
    page.getByText("Kişi sayınız doldu. Başka sandalye için önce seçtiklerinizden birini bırakın."),
  ).toBeVisible();
});

test("sandalye bazlı: az önce alınan sandalyeyi isteyen ikinci alıcı seats_unavailable mesajını görür", async ({
  browser,
  request,
}) => {
  const { events } = crossState();
  const koltuk = events.koltuk;
  const t3 = koltuk.tables.find((t) => t.label === "T3")!;
  const api = salesApi(request);

  const secondCtx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    extraHTTPHeaders: { "x-real-ip": "10.66.0.2" },
  });
  try {
    const second = await secondCtx.newPage();
    await openSeatPicker(second, koltuk.id, 2);
    await pickSeats(second, "T3", [4, 5]);

    // Yoklama kesilir ki ikinci alıcının seçimi kendiliğinden düşmeden hata mesajı gözlemlensin.
    await second.route("**/api/durum/**", (r) => r.abort());

    await buyViaApi(request, {
      eventId: koltuk.id,
      tableId: t3.id,
      quantity: 2,
      seatNos: [3, 4],
      ip: "10.66.1.1",
      buyer: { firstName: "Mehmet", lastName: "Demir", email: "mehmet@example.com" },
    });

    await second.getByRole("region", { name: "Seçiminiz" }).getByRole("button", { name: "Devam et" }).click();
    await expect(second).not.toHaveURL(/\/odeme\//);
    await expect(second.getByText("Seçtiğiniz sandalyelerden biri az önce alındı")).toBeVisible();

    const res = await api.post(
      "orders",
      {
        eventId: koltuk.id,
        clientKey: randomUUID(),
        items: [{ tableId: t3.id, quantity: 2, seatNos: [4, 5] }],
      },
      "10.66.1.2",
    );
    expect(res.status()).toBe(409);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("seats_unavailable");

    await second.unroute("**/api/durum/**");
    await second.reload();
    const finder = second.getByRole("region", { name: "Masa bulucu" });
    await finder.getByRole("list", { name: "Alınabilir masalar" }).getByRole("button", { name: /^Masa T3 ·/ }).click();
    const activeCard = second.getByRole("region", { name: "Seçili masa" });
    await expect(activeCard.getByRole("button", { name: "Sandalye 3, dolu" })).toBeDisabled();
    await expect(activeCard.getByRole("button", { name: "Sandalye 4, dolu" })).toBeDisabled();
  } finally {
    await secondCtx.close();
  }
});
