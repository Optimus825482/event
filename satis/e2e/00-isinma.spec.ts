import { expect, test, type Page } from "@playwright/test";
import { openCheckout } from "./sayfa-yardimcilari";
import { fillBuyer } from "./support/checkout";
import { fakeState, resetOrders } from "./support/fake";

/**
 * Isınma: E2E `next dev` ile koşar; geliştirme sunucusu bir rotayı ilk kez derlerken açık sayfayı yeniden
 * yükleyebilir ve bu, o anda tıklama yapan testi bozar. Dosya adı `00-` ile başlar ve tek işçiyle ilk koşar;
 * ana rotaları (ve ödeme → e-bilet akışını) bir kez derletir. Canlıda bu davranış yoktur.
 */
const { gala } = fakeState().events;

/** İlk derleme sırasındaki yeniden yükleme `goto`'yu yarıda kesebilir (ERR_ABORTED); bu yüzden birkaç kez denenir. */
async function visit(page: Page, path: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(500);
      await page.waitForLoadState("networkidle");
      return;
    } catch (error) {
      if (attempt >= 4) throw error;
    }
  }
}

test("ısınma: ana rotalar ve ödeme akışı bir kez derlenir", async ({ page }) => {
  test.setTimeout(300_000);
  for (const path of ["/", "/hakkimizda", "/etkinlikler", "/biletimi-bul", `/etkinlik/${gala.id}`, `/etkinlik/${gala.id}?kisi=2`, `/etkinlik/${gala.id}/salon?kisi=2`]) {
    await visit(page, path);
  }

  await resetOrders();
  await openCheckout(page, "V2", { quantity: 2 });
  await page.waitForLoadState("networkidle");
  await fillBuyer(page, { lastName: "Isinma" });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Öde" }).click();
  await expect(page).toHaveURL(/\/bilet\//, { timeout: 120_000 });
  await page.waitForLoadState("networkidle");
  await resetOrders();
});
