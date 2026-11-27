import { expect, type Page } from "@playwright/test";

export type BuyerInfo = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function openSeatPicker(page: Page, eventId: string, party: number): Promise<void> {
  await page.goto(`/etkinlik/${eventId}?kisi=${party}#masa-secimi`);
  await expect(page.locator("section#masa-secimi")).toBeVisible();
}

async function focusTable(page: Page, tableLabel: string): Promise<void> {
  const finder = page.getByRole("region", { name: "Masa bulucu" });
  const list = finder.getByRole("list", { name: "Alınabilir masalar" });
  const pattern = new RegExp(`^(Masa|Loca) ${escapeRegex(tableLabel)} ·`);
  const activeCard = page.getByRole("region", { name: "Seçili masa" });
  const heading = activeCard.getByRole("heading", { name: new RegExp(`^(Masa|Loca) ${escapeRegex(tableLabel)}$`) });
  await expect(async () => {
    await list.getByRole("button", { name: pattern }).click();
    await expect(heading).toBeVisible({ timeout: 2000 });
  }).toPass();
}

export async function pickSeats(page: Page, tableLabel: string, seatNos: readonly number[]): Promise<void> {
  await focusTable(page, tableLabel);
  const activeCard = page.getByRole("region", { name: "Seçili masa" });
  for (const seatNo of seatNos) {
    await activeCard.getByRole("button", { name: new RegExp(`^Sandalye ${seatNo}, boş$`) }).click();
  }
}

export async function pickWholeTable(page: Page, tableLabel: string): Promise<void> {
  await focusTable(page, tableLabel);
  const activeCard = page.getByRole("region", { name: "Seçili masa" });
  await activeCard.getByRole("button", { name: "Masanın tamamını seç" }).click();
}

export async function continueToPayment(page: Page): Promise<void> {
  const summary = page.getByRole("region", { name: "Seçiminiz" });
  await summary.getByRole("button", { name: "Devam et" }).click();
  await expect(page).toHaveURL(/\/odeme\//);
  await expect(page.getByText(/Kalan süre 0\d:\d{2}/)).toBeVisible();
}

export async function payDemo(
  page: Page,
  buyer: BuyerInfo,
  options?: { testDecline?: boolean },
): Promise<{ pnr: string; ticketUrl: string }> {
  await expect(page.getByText("DEMO - gerçek ödeme alınmadı")).toBeVisible();
  await page.getByLabel("Ad", { exact: true }).fill(buyer.firstName);
  await page.getByLabel("Soyad").fill(buyer.lastName);
  await page.getByLabel("E-posta").fill(buyer.email);
  if (buyer.phone) {
    await page.getByLabel("Telefon (isteğe bağlı)").fill(buyer.phone);
  }
  await page.getByRole("checkbox").check();
  if (options?.testDecline) {
    await page.getByRole("button", { name: "Reddet (deneme)" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Ödeme reddedildi" })).toBeVisible();
  }
  await page.getByRole("button", { name: "Öde" }).click();
  await expect(page).toHaveURL(/\/bilet\//);

  const pnrText = (await page.getByText(/PNR [2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}/).textContent())!;
  const pnr = pnrText.replace("PNR ", "").trim();
  return { pnr, ticketUrl: page.url() };
}

export async function ticketSeats(page: Page): Promise<{ table: string; seatNo: number | null }[]> {
  const cards = page.locator("li").filter({ has: page.getByRole("img", { name: /Bilet \d+ QR kodu/ }) });
  const count = await cards.count();
  const out: { table: string; seatNo: number | null }[] = [];
  for (let i = 0; i < count; i++) {
    const ps = await cards.nth(i).locator("p").allTextContents();
    const tableLine = ps.find((t) => t.startsWith("Masa "));
    const seatLine = ps.find((t) => t.startsWith("Sandalye "));
    out.push({
      table: tableLine ? tableLine.slice("Masa ".length).trim() : "",
      seatNo: seatLine ? Number(seatLine.slice("Sandalye ".length).trim()) : null,
    });
  }
  return out;
}

export async function hasWebgl(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      if (!gl) return false;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return true;
    } catch {
      return false;
    }
  });
}
