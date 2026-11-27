import type { Page } from "@playwright/test";
import type { EventDetail } from "../../src/lib/core/contract";
import { diamondSeed, FAKE_IMAGES } from "../../tests/helpers/fake-core";
import { fakeState } from "./fake";

/** Demo Diamond salonuna benzer etkinliği sahte çekirdeğe ekler (sahne görüşü seti `diamond`). */
export async function addDiamondEvent(name: string, saleState: "open" | "closed"): Promise<EventDetail> {
  const response = await fetch(`${fakeState().coreUrl}/__fake/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...diamondSeed(),
      name,
      saleState,
      saleMode: "seat",
      demo: true,
      isDemo: true,
      artistName: "Demo Sanatçı",
      artistImage: FAKE_IMAGES.artist,
      site: { heroImage: FAKE_IMAGES.hero, sightlineSet: "diamond" },
    }),
  });
  if (!response.ok) throw new Error(`Sahte çekirdek etkinlik eklemedi: ${response.status}`);
  return (await response.json()) as EventDetail;
}

/**
 * Satış sitesi etkinlik listesini 30 sn önbellekte tutar; koşu sırasında eklenen etkinlik liste yenilenene dek
 * "bulunamadı" döner. Sayfa açılana dek (en çok ~90 sn) yeniden dener.
 */
export async function gotoListedEvent(page: Page, path: string): Promise<void> {
  const deadline = Date.now() + 90_000;
  // Aynı adrese (#parça ile) yeniden `goto` belge içi gezinmedir; yeniden denemede sayfa yenilenir.
  let response = await page.goto(path);
  for (;;) {
    const missing =
      response?.status() === 404 ||
      (await page.getByRole("heading", { level: 1, name: "Etkinlik bulunamadı" }).count()) > 0;
    if (!missing) return;
    if (Date.now() > deadline) throw new Error(`Etkinlik listede görünmedi: ${path}`);
    await page.waitForTimeout(2_000);
    response = await page.reload();
  }
}
