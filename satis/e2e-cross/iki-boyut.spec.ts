import { expect, test } from "@playwright/test";
import { continueToPayment, hasWebgl, openSeatPicker, payDemo, pickSeats, ticketSeats } from "./support/buyer";
import { warmCore } from "./support/core";
import { crossState } from "./support/state";

test.use({ extraHTTPHeaders: { "x-real-ip": "10.66.0.3" } });

function sortSeats(seats: readonly { table: string; seatNo: number | null }[]) {
  return [...seats].sort((a, b) => a.table.localeCompare(b.table) || (a.seatNo ?? 0) - (b.seatNo ?? 0));
}

test.beforeAll(async ({ request }) => {
  test.setTimeout(240_000);
  await warmCore(request, [crossState().events.koltuk.id]);
});

test.describe("2B yolu", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("hareket azaltma açıkken 3B sunulmaz ve aynı satın alma tamamlanır", async ({ page }) => {
    const { events } = crossState();
    const koltuk = events.koltuk;

    await openSeatPicker(page, koltuk.id, 2);
    await expect(page.locator("#masa-secimi canvas")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "3B görünüm" })).toHaveCount(0);

    await pickSeats(page, "T5", [7, 8]);
    await continueToPayment(page);
    await payDemo(page, { firstName: "Deniz", lastName: "Ak", email: "deniz@example.com" });

    expect(sortSeats(await ticketSeats(page))).toEqual([
      { table: "T5", seatNo: 7 },
      { table: "T5", seatNo: 8 },
    ]);
  });
});

test("WebGL varsa sayfa 3B açılır ve panelden satın alma yine tamamlanır", async ({ page }) => {
  const { events } = crossState();
  const koltuk = events.koltuk;

  await openSeatPicker(page, koltuk.id, 2);
  test.skip(!(await hasWebgl(page)), "bu tarayıcıda WebGL yok; 3B iddiası atlanır");

  await expect(page.locator("#masa-secimi canvas")).toBeVisible();
  await pickSeats(page, "T6", [1, 2]);
  await continueToPayment(page);
});
