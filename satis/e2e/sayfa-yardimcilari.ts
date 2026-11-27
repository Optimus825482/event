import { expect, type Page } from "@playwright/test";
import type { EventDetail } from "../src/lib/core/contract";
import { fakeState, holdAs, tableId } from "./support/fake";

/** Sayfada tam bir h1 vardır ve hiçbir başlık bir öncekinden birden fazla düzey atlamaz. */
export async function expectHeadingOrder(page: Page): Promise<void> {
  const levels = await page.evaluate(() =>
    Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((el) => Number(el.tagName[1])),
  );
  expect(levels.filter((l) => l === 1)).toHaveLength(1);
  for (let i = 1; i < levels.length; i++) {
    expect(levels[i]!).toBeLessThanOrEqual(levels[i - 1]! + 1);
  }
}

/** Sahte çekirdeğin holdAs denetim çağrısıyla sipariş açar ve ödeme sayfasına gider. */
export async function openCheckout(
  page: Page,
  label: string,
  options?: { quantity?: number; event?: EventDetail },
): Promise<string> {
  const event = options?.event ?? fakeState().events.gala;
  const quantity = options?.quantity ?? 1;
  const order = await holdAs(event.id, tableId(event, label), quantity);
  await page.goto(`/odeme/${order.orderToken}`);
  return order.orderToken;
}
