import { expect, type Page } from "@playwright/test";

export type TableSpec = { label: string; capacity: number };

/** Yeni etkinlik sihirbazının ilk adımıyla etkinlik oluşturur (taslak; başlangıç Kıbrıs duvar saatidir) ve kimliğini döndürür. */
export async function createEvent(page: Page, name: string, startsAt = "2030-06-15T20:00"): Promise<string> {
  await page.goto("/events/new");
  await page.getByLabel("Etkinlik adı").fill(name);
  await page.getByLabel("Başlangıç", { exact: true }).fill(startsAt);
  await page.getByLabel("Etkinlik türü").fill("Gala");
  await page.getByRole("button", { name: "Etkinlik oluştur" }).click();
  // Sihirbaz oluşturmadan sonra şablon adımına geçer; şablonsuz doğrudan etkinliğe gidilir.
  await page.getByRole("link", { name: "Etkinliğe git" }).click();
  await page.waitForURL(/\/events\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  const id = page.url().split("/").pop();
  if (!id) throw new Error("Etkinlik kimliği okunamadı");
  return id;
}

/** Masa yerleşimi düzenleyicisinde masa ekler, etiket/kapasite verir ve kaydeder. */
export async function addTablesAndSave(page: Page, eventId: string, tables: TableSpec[]): Promise<void> {
  await page.goto(`/events/${eventId}/venue`);
  await expect(page.getByRole("button", { name: "Masa ekle" })).toBeVisible();
  for (const table of tables) {
    await page.getByRole("button", { name: "Masa ekle" }).click();
    const panel = page.getByRole("region", { name: "Masa özellikleri" });
    await panel.getByLabel("Etiket").fill(table.label);
    await panel.getByLabel("Etiket").press("Enter");
    await expect(panel.getByLabel("Etiket")).toHaveValue(table.label);
    await panel.getByLabel("Kapasite").fill(String(table.capacity));
    await panel.getByLabel("Kapasite").press("Enter");
    await expect(panel.getByLabel("Kapasite")).toHaveValue(String(table.capacity));
  }
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Yerleşim kaydedildi" })).toBeVisible();
}

export async function publishEvent(page: Page, eventId: string): Promise<void> {
  await page.goto(`/events/${eventId}`);
  await page.getByRole("button", { name: "Yayınla" }).click();
  await expect(page.getByText("Yayında", { exact: true })).toBeVisible();
}

/** Yeni rezervasyon formunu doldurup gönderir (yönlendirmeyi beklemez). */
export async function fillReservation(
  page: Page,
  input: { table: string; guests: number; name: string; phone?: string },
): Promise<void> {
  const select = page.getByLabel("Masa", { exact: true });
  const value = await select.locator("option", { hasText: input.table }).first().getAttribute("value");
  if (!value) throw new Error(`Masa seçeneği bulunamadı: ${input.table}`);
  await select.selectOption(value);
  await page.getByLabel("Kişi sayısı").fill(String(input.guests));
  await page.getByLabel("Misafir adı").fill(input.name);
  if (input.phone) await page.getByLabel("Telefon").fill(input.phone);
  await page.getByRole("button", { name: "Rezervasyonu oluştur" }).click();
}
