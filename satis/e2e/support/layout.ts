import { expect, type Page } from "@playwright/test";

/** Sayfa yatayda taşmaz: kaydırma genişliği görünür genişliği aşmaz. */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

/** WebGL'i devre dışı bırakır: salon kesin 2B krokiyle açılır (plan-3d.spec'teki desen). */
export async function disableWebgl(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, "WebGLRenderingContext", { value: undefined });
    Object.defineProperty(window, "WebGL2RenderingContext", { value: undefined });
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
      return (original as (...a: unknown[]) => unknown).call(this, type, ...rest) as never;
    } as typeof original;
  });
}
