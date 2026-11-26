import { expect, test } from "@playwright/test";
import { fakeRequests, fakeState } from "./support/fake";
import { expectNoHorizontalOverflow } from "./support/layout";

const { gala, kapali } = fakeState().events;

test("etkinlik sayfası planı kalan sandalyelerle gösterir ve taşmaz", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}`);
  await expect(page.getByRole("heading", { name: "Yılbaşı Galası" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Masa A1, Standart, boş sandalye 8/8" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Masa C1, satışta değil" })).toBeVisible();
  await expect(page.getByText("Premium")).toBeVisible();
  await expect(page.getByText("2.500,00 ₺")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("yakınlaştırma düğmeleri planı büyütür, Sığdır geri getirir", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}`);
  const a1 = page.getByRole("button", { name: /Masa A1/ });
  const before = (await a1.boundingBox())!.width;
  await page.getByRole("button", { name: "Yakınlaştır" }).click();
  expect((await a1.boundingBox())!.width).toBeGreaterThan(before);
  await page.getByRole("button", { name: "Sığdır" }).click();
  expect((await a1.boundingBox())!.width).toBeCloseTo(before, 0);
  await expectNoHorizontalOverflow(page);
});

test("satışı kapalı etkinlikte durum yazılır", async ({ page }) => {
  await page.goto(`/etkinlik/${kapali.id}`);
  await expect(page.getByText("Satış kapalı")).toBeVisible();
});

test("bilinmeyen etkinlik 404 verir ve çekirdeğe doluluk isteği gitmez", async ({ page }) => {
  const before = (await fakeRequests()).filter((r) => r.path.endsWith("/availability")).length;
  const res = await page.goto(`/etkinlik/${crypto.randomUUID()}`);
  expect(res!.status()).toBe(404);
  expect((await fakeRequests()).filter((r) => r.path.endsWith("/availability")).length).toBe(before);
});
