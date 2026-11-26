import { randomBytes } from "node:crypto";

import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { watchCspViolations } from "./csp";
import { adminPassword, adminUsername, EMPTY_STATE, loginAs } from "./fixtures";
import { addTablesAndSave, createEvent, fillReservation, publishEvent } from "./ui";

export type Session = Awaited<ReturnType<BrowserContext["storageState"]>>;

export type OfflineFixture = {
  eventId: string;
  eventName: string;
  /** Yönetici oturumu (üretim sunucusunda arayüzden açılmış çerezler). */
  admin: Session;
};

export type SeedSpec = {
  eventName: string;
  /** Her misafir kendi masasında (T1, T2, ...), 4 kişilik. */
  guests: string[];
  /** Walk-in için boş bırakılan masa sayısı (W1, W2, ...). */
  freeTables: number;
};

/** Üretim sunucusunda yöneticiyle girip etkinlik, masalar ve rezervasyonları arayüzden oluşturur. */
export async function seedEvent(browser: Browser, spec: SeedSpec): Promise<OfflineFixture> {
  const context = await browser.newContext({ storageState: EMPTY_STATE });
  const page = await context.newPage();
  try {
    await signIn(page, adminUsername, adminPassword());
    const eventId = await createEvent(page, spec.eventName);
    const tables = [
      ...spec.guests.map((_, i) => ({ label: `T${i + 1}`, capacity: 4 })),
      ...Array.from({ length: spec.freeTables }, (_, i) => ({ label: `W${i + 1}`, capacity: 4 })),
    ];
    await addTablesAndSave(page, eventId, tables);
    await publishEvent(page, eventId);
    for (const [i, name] of spec.guests.entries()) {
      await page.goto(`/reservations/${eventId}/new`);
      await fillReservation(page, { table: `T${i + 1}`, guests: 2, name });
      await page.waitForURL(new RegExp(`/reservations/${eventId}/[0-9a-f-]{36}$`));
    }
    return { eventId, eventName: spec.eventName, admin: await context.storageState() };
  } finally {
    await context.close();
  }
}

/**
 * Yeni bir "cihaz": temiz bir tarayıcı bağlamı (kendi IndexedDB'si, önbellekleri ve service worker'ı).
 * Yakalanmamış sayfa hataları `errors`'a toplanır; test sonunda boş olmalıdır.
 */
export async function openDevice(
  browser: Browser,
  options: { session?: Session; errors: string[] },
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ storageState: options.session ?? EMPTY_STATE });
  const page = await context.newPage();
  page.on("pageerror", (e) => options.errors.push(`${page.url()} :: ${e.message}`));
  watchCspViolations(page, options.errors);
  return { context, page };
}

// Better Auth giriş ucu, güvenilir IP başlığı yokken tüm istemciler için tek kovada, SON istekten 10 sn içinde
// gelen 3. isteği 429 ile reddeder (pencere son isteğe göre kayar). Seri girişler art arda en çok 2 olacak şekilde
// aralanır; arayüz 429'u "parola hatalı" diye gösterdiği için sınır burada önceden gözetilir.
const RATE_WINDOW_MS = 10_300;
let lastSignInAt = 0;
let signInStreak = 0;

export async function signIn(page: Page, username: string, password: string): Promise<void> {
  if (Date.now() - lastSignInAt > RATE_WINDOW_MS) signInStreak = 0;
  if (signInStreak >= 2) {
    await page.waitForTimeout(Math.max(0, lastSignInAt + RATE_WINDOW_MS - Date.now()));
    signInStreak = 0;
  }
  signInStreak += 1;
  lastSignInAt = Date.now();
  const response = page.waitForResponse((r) => r.url().includes("/api/auth/sign-in"));
  await loginAs(page, username, password);
  const result = await response;
  expect(result.status(), `giriş yanıtı: ${await result.text()}`).toBe(200);
  await expect(page.getByRole("button", { name: "Profil menüsü" })).toBeVisible();
}

/** Çıkış, profil açılır menüsünün içindedir: önce menüyü açar, sonra "Çıkış yap" öğesini seçer. */
export async function clickSignOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Profil menüsü" }).click();
  await page.getByRole("menuitem", { name: "Çıkış yap" }).click();
}

export async function signOut(page: Page): Promise<void> {
  await clickSignOut(page);
  await expect(page).toHaveURL(/\/login/);
}

/** Yönetici arayüzünden yalnızca check-in izni olan ikinci bir Casino kullanıcısı oluşturur. Parola rastgele. */
export async function createDoorUser(page: Page, username: string): Promise<string> {
  const password = `Kp1-${randomBytes(12).toString("base64url")}`;
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Yeni kullanıcı" }).click();
  await page.getByLabel("Kullanıcı adı", { exact: true }).fill(username);
  await page.getByLabel("Ad soyad").fill("Kapı Görevlisi");
  // Yalnızca check-in izni olan Casino kullanıcısı.
  await page.getByLabel("Rol", { exact: true }).selectOption({ label: "Departman kullanıcısı" });
  await page.getByLabel("Casino", { exact: true }).check();
  await page.getByLabel("Check-in: Görüntüle", { exact: true }).check();
  await page.getByLabel("Check-in: Oluştur", { exact: true }).check();
  await page.getByLabel("Parola", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Kullanıcı oluştur" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Kullanıcı oluşturuldu" })).toBeVisible();
  return password;
}

/**
 * Check-in konsolunu açar, service worker'ın sayfayı denetlemesini ve kabuğun önbelleğe girmesini bekler.
 * İlk yüklemede sayfa worker tarafından denetlenmediğinden bir kez yenilenir (statik dosyalar da önbelleğe girer).
 */
export async function openConsoleAndWarm(page: Page, eventId: string, eventName: string): Promise<void> {
  await page.goto(`/check-in/${eventId}`);
  await expect(page.getByRole("heading", { name: eventName, level: 1 })).toBeVisible();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: eventName, level: 1 })).toBeVisible();
  await expect.poll(() => shellKeys(page)).toContain(`${new URL(page.url()).origin}/check-in/${eventId}`);
}

/** `eventflow-shell-*` önbelleklerindeki tüm istek adresleri. */
export function shellKeys(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      if (!name.startsWith("eventflow-shell-")) continue;
      const cache = await caches.open(name);
      for (const request of await cache.keys()) urls.push(request.url);
    }
    return urls;
  });
}

/** Tüm önbelleklerde `/api/` ile başlayan bir istek var mı (olmamalı). */
export function cachedApiUrls(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) if (new URL(request.url).pathname.startsWith("/api/")) urls.push(request.url);
    }
    return urls;
  });
}

export const queueRegion = (page: Page) => page.getByRole("region", { name: "Çevrimdışı kuyruk" });

export async function expectPending(page: Page, count: number): Promise<void> {
  const text = count === 0 ? "Bekleyen giriş yok" : `Bekleyen giriş: ${count}`;
  await expect(queueRegion(page).getByText(text)).toBeVisible();
}

/** Check-in konsolunun sekmesine geçer; gizli sekmedeki alanlar kullanılamaz. */
export async function openConsoleTab(page: Page, name: "Tarama" | "Ara" | "Geçmiş" | "Walk-in"): Promise<void> {
  await page.getByRole("tablist", { name: "Check-in bölümleri" }).getByRole("tab", { name, exact: true }).click();
}

export async function scanCode(page: Page, code: string): Promise<void> {
  await openConsoleTab(page, "Tarama");
  await page.getByRole("textbox", { name: "QR kod" }).fill(code);
  await page.getByRole("textbox", { name: "QR kod" }).press("Enter");
}

export async function submitWalkIn(page: Page, input: { table: string; name: string; guests: number }): Promise<void> {
  await openConsoleTab(page, "Walk-in");
  const form = page.getByRole("form", { name: "Walk-in misafir kaydı" });
  const select = form.getByLabel("Masa");
  const value = await select.locator("option", { hasText: new RegExp(`^${input.table} `) }).first().getAttribute("value");
  if (!value) throw new Error(`Walk-in masası bulunamadı: ${input.table}`);
  await select.selectOption(value);
  await form.getByLabel("Misafir adı").fill(input.name);
  await form.getByLabel("Kişi sayısı").fill(String(input.guests));
  await form.getByRole("button", { name: "Kaydet ve giriş yap" }).click();
}
