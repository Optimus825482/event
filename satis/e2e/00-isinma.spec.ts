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
      // Yönlendirme ya da yeniden yükleme sırasında `goto` yanıtsız (null) dönebilir; o zaman yalnızca yüklenmeyi bekle.
      if (response) expect(response.status()).toBeLessThan(500);
      await page.waitForLoadState("networkidle");
      return;
    } catch (error) {
      if (attempt >= 6) throw error;
    }
  }
}

test("ısınma: ana rotalar ve ödeme akışı bir kez derlenir", async ({ page }) => {
  // SATIS_E2E_SECRET her koşuda rastgele üretildiğinden Turbopack sunucu paketini yeniden derler;
  // soğuk derleme + checkout akışı yavaş makinelerde 5 dk'yı aşabildiği için bütçe 10 dk.
  // Salon sayfası önce ısıtılır: `?kisi=2` ile gelen istek salona yönlendirilir ve yönlendirme,
  // salon rotası derlenmemişken kesintiye uğrar.
  test.setTimeout(600_000);
  for (const path of ["/", "/hakkimizda", "/etkinlikler", "/biletimi-bul", `/etkinlik/${gala.id}`, `/etkinlik/${gala.id}/salon?kisi=2`, `/etkinlik/${gala.id}?kisi=2`]) {
    await visit(page, path);
  }

  // Salon akışı: EventSales "Ödeme Yap" eylemi (holdAction) ilk çağrıda derlenir; seçim akışıyla ısıtılır.
  // Tutma başarılıysa salonda "Adım 2 · Ödeme" penceresi açılır (ayrı /odeme adresine gitmez).
  await resetOrders();
  await visit(page, `/etkinlik/${gala.id}/salon?kisi=1`);
  await page.getByRole("searchbox", { name: "Masa numarası ara" }).fill("a1");
  await page.getByRole("region", { name: "Masa arama sonuçları" }).getByRole("button", { name: /^Masa A1/ }).click();
  const a1Dialog = page.getByRole("dialog", { name: "Masa A1" });
  await expect(a1Dialog).toBeVisible({ timeout: 30_000 });
  await a1Dialog.getByRole("button", { name: "Ödeme Yap" }).click();
  await expect(page.getByRole("dialog", { name: "Ödeme" })).toBeVisible({ timeout: 120_000 });

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
