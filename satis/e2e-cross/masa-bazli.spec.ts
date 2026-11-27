import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { continueToPayment, openSeatPicker, payDemo, pickWholeTable, ticketSeats } from "./support/buyer";
import { salesApi, warmCore } from "./support/core";
import { crossState } from "./support/state";

test.use({ extraHTTPHeaders: { "x-real-ip": "10.66.0.5" } });

test.beforeAll(async ({ request }) => {
  test.setTimeout(240_000);
  await warmCore(request, [crossState().events.masa.id]);
});

test("masa bazlı: masa bütün satılır, fiyat paneli bütün masayı yazar, bilette sandalye numarası yok", async ({
  page,
  request,
}) => {
  const { events } = crossState();
  const masa = events.masa;
  const t1 = masa.tables.find((t) => t.label === "T1")!;
  const api = salesApi(request);

  await openSeatPicker(page, masa.id, 2);
  await pickWholeTable(page, "T1");

  const activeCard = page.getByRole("region", { name: "Seçili masa" });
  await expect(activeCard.getByRole("button", { name: /^Sandalye / })).toHaveCount(0);
  await expect(activeCard.getByText("8 kişilik masa · 8 bilet")).toBeVisible();
  await expect(page.getByRole("region", { name: "Seçiminiz" }).getByText("20.000,00 ₺")).toBeVisible();

  await continueToPayment(page);
  const { ticketUrl } = await payDemo(page, { firstName: "Can", lastName: "Yılmaz", email: "can@example.com" });

  const seats = await ticketSeats(page);
  expect(seats).toHaveLength(8);
  expect(seats.every((s) => s.table === "T1" && s.seatNo === null)).toBe(true);

  const orderToken = ticketUrl.split("/bilet/")[1]?.split(/[?#]/)[0];
  expect(orderToken).toBeTruthy();
  const order = (await (await api.get(`orders/${orderToken}`)).json()) as {
    tickets: { seatNo: number | null }[];
  };
  expect(order.tickets).toHaveLength(8);
  expect(order.tickets.every((t) => t.seatNo === null)).toBe(true);

  const av = (await (await api.get(`events/${masa.id}/availability`)).json()) as {
    tables: { id: string; free: number }[];
  };
  expect(av.tables.find((t) => t.id === t1.id)?.free).toBe(0);
});

test("masa bazlı: eksik adet ve seatNos çekirdekte reddedilir", async ({ request }) => {
  const { events } = crossState();
  const masa = events.masa;
  const t2 = masa.tables.find((t) => t.label === "T2")!;
  const api = salesApi(request);

  const partialRes = await api.post(
    "orders",
    {
      eventId: masa.id,
      clientKey: randomUUID(),
      items: [{ tableId: t2.id, quantity: 3 }],
    },
    "10.66.0.5",
  );
  expect(partialRes.status()).toBe(409);
  expect(((await partialRes.json()) as { error: { code: string } }).error.code).toBe("whole_table_required");

  const seatNosRes = await api.post(
    "orders",
    {
      eventId: masa.id,
      clientKey: randomUUID(),
      items: [{ tableId: t2.id, quantity: 8, seatNos: [1, 2, 3, 4, 5, 6, 7, 8] }],
    },
    "10.66.0.5",
  );
  expect(seatNosRes.status()).toBe(400);
  expect(((await seatNosRes.json()) as { error: { code: string } }).error.code).toBe("invalid");
});
