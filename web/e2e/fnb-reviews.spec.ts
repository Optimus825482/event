import { randomBytes } from "node:crypto";

import type { Page } from "@playwright/test";

import { E2E_BASE_URL } from "./support/constants";
import { withDb } from "./support/db";
import { expect, test, EMPTY_STATE, loginAs as login } from "./support/fixtures";
import { createEvent } from "./support/ui";

// Senaryolar aynı etkinlik ve aynı kullanıcılar üzerinde sırayla ilerler.
test.describe.configure({ mode: "serial" });

const EVENT_NAME = "E2E F&B Değerlendirme";
const MANAGER = "e2e-fnb-yonetici";
const CAPTAIN = "e2e-fnb-kaptan";
const SUPERVISOR = "e2e-fnb-supervizor";
// Parolalar her koşuda rastgele üretilir; yalnızca bellekte yaşar.
const PASSWORD = `Fb1-${randomBytes(12).toString("base64url")}`;

const NAMES = {
  captain: "Kaptan Can",
  supervisor: "Süpervizör Sema",
  waiter: "Garson Gül",
  head: "Kısım Kemal",
} as const;

let eventId = "";

/** Taşma denetimi: sayfa yatayda kaydırılmaz (375px genişlikte içerik kenara dayanmaz). */
async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "yatay taşma (px)").toBeLessThanOrEqual(0);
}

/** Girişin tamamlanmasını (oturum çerezi + yönlendirme) bekler; sonraki `goto` giriş isteğini yarıda kesmesin. */
async function loginAs(page: Page, username: string, password: string): Promise<void> {
  // Giriş hız sınırı (429) art arda girişlerde devreye girebilir: bildirilen süre kadar bekleyip yeniden dener.
  for (let attempt = 0; attempt < 3; attempt++) {
    await login(page, username, password);
    const throttled = page.getByRole("alert").filter({ hasText: "Çok fazla deneme yapıldı" });
    // İki kol da sınırlı ve hatayı yutar: kaybeden kol bağlam kapanırken askıda kalıp beklenmedik hata üretmez.
    const outcome = await Promise.race([
      page
        .waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 })
        .then(() => "ok" as const)
        .catch(() => "none" as const),
      throttled
        .waitFor({ timeout: 15_000 })
        .then(() => "throttled" as const)
        .catch(() => "none" as const),
    ]);
    if (outcome === "ok") return;
    if (outcome === "none") continue;
    const seconds = Number(/(\d+) saniye/.exec((await throttled.textContent()) ?? "")?.[1] ?? "10");
    await page.waitForTimeout((seconds + 1) * 1000);
  }
  throw new Error(`${username} girişi hız sınırı yüzünden tamamlanamadı`);
}

async function createFnbUser(page: Page, username: string, name: string, level: "Yönetici" | "Kullanıcı"): Promise<void> {
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Yeni kullanıcı" }).click();
  await page.getByLabel("Kullanıcı adı", { exact: true }).fill(username);
  await page.getByLabel("Ad soyad").fill(name);
  await page.getByLabel("Rol", { exact: true }).selectOption({ label: "Departman kullanıcısı" });
  await page.getByLabel("Food & Beverage", { exact: true }).check();
  await page.getByLabel("Food & Beverage düzeyi").selectOption({ label: level });
  if (level === "Kullanıcı") {
    for (const verb of ["Görüntüle", "Oluştur", "Düzenle"]) {
      await page.getByLabel(`Değerlendirmeler: ${verb}`, { exact: true }).check();
    }
  }
  await page.getByLabel("Parola", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Kullanıcı oluştur" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Kullanıcı oluşturuldu" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: username })).toBeVisible();
}

/**
 * Personel kayıtları, ekip ve masa grubu doğrudan veritabanına yazılır: arayüzde süpervizör atayan bir
 * alan yoktur ve Konva tuvali sürükleme gerektirir. Kullanıcı–personel bağı da yalnızca kayıttan kurulur.
 */
async function seedStructure(): Promise<void> {
  await withDb(async (pool) => {
    const staffIds: Record<string, string> = {};
    for (const [key, fullName] of Object.entries(NAMES)) {
      const res = await pool.query<{ id: string }>(
        "insert into staff (sicil_no, full_name) values ($1, $2) returning id",
        [`E2E-${key}`, fullName],
      );
      staffIds[key] = res.rows[0]!.id;
    }
    for (const [username, key] of [[CAPTAIN, "captain"], [SUPERVISOR, "supervisor"]] as const) {
      await pool.query("update users set staff_id = $1 where username = $2", [staffIds[key], username]);
    }
    const table = async (label: string, isLoca: boolean) => {
      const res = await pool.query<{ id: string }>(
        "insert into event_tables (event_id, label, capacity, x, y, is_loca, floor) values ($1, $2, 6, $3, 0, $4, $5) returning id",
        [eventId, label, isLoca ? 200 : 0, isLoca, isLoca ? 2 : 1],
      );
      return res.rows[0]!.id;
    };
    const normal = await table("A1", false);
    await table("L1", true);
    await table("L2", true);

    const team = await pool.query<{ id: string }>(
      "insert into teams (event_id, name, leader_staff_id) values ($1, 'Ekip Kaptan Can', $2) returning id",
      [eventId, staffIds.captain],
    );
    const teamId = team.rows[0]!.id;
    await pool.query("insert into team_members (team_id, staff_id, is_leader) values ($1, $2, true), ($1, $3, false)", [
      teamId,
      staffIds.captain,
      staffIds.waiter,
    ]);
    const group = await pool.query<{ id: string }>(
      "insert into table_groups (event_id, name, team_id, supervisor_staff_id) values ($1, 'Salon A', $2, $3) returning id",
      [eventId, teamId, staffIds.supervisor],
    );
    await pool.query("insert into table_group_tables (event_id, table_group_id, table_id) values ($1, $2, $3)", [
      eventId,
      group.rows[0]!.id,
      normal,
    ]);
  });
}

test.describe("F&B hiyerarşik değerlendirme", () => {
  test("yönetici F&B yöneticisi ve iki F&B kullanıcısı oluşturur; etkinlikte değerlendirme açılır", async ({ page }) => {
    eventId = await createEvent(page, EVENT_NAME);
    await createFnbUser(page, MANAGER, "F&B Yönetici", "Yönetici");
    await createFnbUser(page, CAPTAIN, NAMES.captain, "Kullanıcı");
    await createFnbUser(page, SUPERVISOR, NAMES.supervisor, "Kullanıcı");
    await seedStructure();

    // Değerlendirme Entertainment tarafından (yönetici arayüzünden) etkinlik bazında açılır.
    await page.goto(`/events/${eventId}`);
    const toggle = page.getByRole("switch", { name: "Personel değerlendirmesi açık" });
    await toggle.click();
    await expect(toggle).toBeChecked();
  });

  test("F&B yöneticisi sihirbazda locaları gruplar ve kısım sorumlusu atar (375px'te taşmaz)", async ({ browser }) => {
    const context = await browser.newContext({ storageState: EMPTY_STATE, viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    try {
      await loginAs(page, MANAGER, PASSWORD);
      await page.goto(`/events/${eventId}/team-organization`);

      await page.getByRole("button", { name: /Localar/ }).first().click();
      await expect(page.getByRole("heading", { name: "Localar", level: 2 })).toBeVisible();
      const locaRows = page.getByRole("row").filter({ hasText: /^L[12]/ });
      await expect(locaRows).toHaveCount(2);
      await expectNoHorizontalOverflow(page);

      await page.getByRole("button", { name: "Grupsuz locaları gruplandır" }).click();
      await expect(page.getByText("2 loca grubu oluşturuldu.")).toBeVisible();
      await expect(page.getByRole("row").filter({ hasText: "Loca L1" })).toBeVisible();
      await expect(page.getByRole("row").filter({ hasText: "Loca L2" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Grupsuz locaları gruplandır" })).toBeDisabled();
      await expectNoHorizontalOverflow(page);

      await page.getByRole("button", { name: /Özet ve Kaydet/ }).first().click();
      await expect(page.getByRole("heading", { name: "Kısım sorumluları", level: 3 })).toBeVisible();
      await page.getByLabel(NAMES.head, { exact: true }).check();
      await page.getByRole("button", { name: "Kaydet", exact: true }).click();
      await expect(page.getByText("Kısım sorumluları kaydedildi.")).toBeVisible();
      await expect(page.getByRole("listitem").filter({ hasText: NAMES.head })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });

  test("süpervizör ekip kaptanını kısa formla 4 yıldız değerlendirip tamamlar; menüde Değerlendirmeler'i görür", async ({ browser }) => {
    const context = await browser.newContext({ storageState: EMPTY_STATE, viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    try {
      await loginAs(page, SUPERVISOR, PASSWORD);
      await page.goto("/fnb/team/reviews");
      // 375px'te menü gizli olabilir: masaüstü genişliğinde de menü bağlantısı denetlenir (aşağıda).
      await expect(page.getByRole("heading", { name: "Değerlendirmeler", level: 1 })).toBeVisible();
      await page.getByRole("link", { name: new RegExp(EVENT_NAME) }).click();
      await page.waitForURL(/\/fnb\/team\/reviews\/[0-9a-f-]{36}$/);

      const captain = page.getByRole("listitem").filter({ hasText: NAMES.captain });
      await captain.locator("summary").click();
      await expect(captain.getByText("Kısa değerlendirme")).toBeVisible();
      await captain.getByRole("button", { name: "4 puan" }).click();
      await captain.getByLabel("Kısa not").fill("Saha yönetimi çok iyiydi.");
      await expectNoHorizontalOverflow(page);

      // Form türü geçişi: puan varken onay istenir, puanlar silinir, not taşınır; puansız geçiş doğrudandır.
      await captain.getByRole("button", { name: "Ayrıntılı forma geç" }).click();
      await page.getByRole("button", { name: "Devam et" }).click();
      await expect(captain.getByText("Ayrıntılı değerlendirme")).toBeVisible();
      await captain.getByRole("button", { name: "Kısa forma geç" }).click();
      await expect(captain.getByText("Kısa değerlendirme")).toBeVisible();
      await expect(captain.getByText("Henüz puan verilmedi")).toBeVisible();
      await expect(captain.getByLabel("Kısa not")).toHaveValue("Saha yönetimi çok iyiydi.");
      await captain.getByRole("button", { name: "4 puan" }).click();
      await expect(captain.getByText("4 / 5 puan verildi")).toBeVisible();

      await captain.getByRole("button", { name: "Tamamla", exact: true }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Tamamla", exact: true }).click();
      await expect(captain.getByText(/Tamamlandı · 80/)).toBeVisible();

      // Tamamlanan kısa değerlendirme salt okunurdur.
      await page.reload();
      const done = page.getByRole("listitem").filter({ hasText: NAMES.captain });
      await done.locator("summary").click();
      await expect(done.getByText("Genel puan: 4 / 5")).toBeVisible();
      await expect(done.getByText("Kısa not: Saha yönetimi çok iyiydi.")).toBeVisible();
      await expect(done.getByRole("button", { name: "Tamamla", exact: true })).toHaveCount(0);
      await expectNoHorizontalOverflow(page);

      // Masaüstü genişliğinde menüde Food & Beverage › Değerlendirmeler görünür.
      await page.setViewportSize({ width: 1280, height: 800 });
      const nav = page.getByRole("navigation", { name: "Ana menü" });
      await expect(nav.getByRole("link", { name: "Değerlendirmeler", exact: true })).toBeVisible();
      // Menü öğesi /fnb/team altında etkindir; sayfa yolu modülü ve "Ekip Panosu"nu gösterir.
      await expect(nav.getByRole("link", { name: "Değerlendirmeler", exact: true })).toHaveAttribute("aria-current", "page");
      const crumbs = page.getByRole("navigation", { name: "Sayfa yolu" });
      await expect(crumbs).toContainText("Food & Beverage");
      await expect(crumbs).toContainText("Ekip Panosu");
    } finally {
      await context.close();
    }
  });

  test("kaptan yalnızca kendi ekibini görür (süpervizörü göremez); eski /leader/reviews adresi yeni sayfaya yönlenir", async ({ browser }) => {
    const context = await browser.newContext({ storageState: EMPTY_STATE });
    const page = await context.newPage();
    try {
      await loginAs(page, CAPTAIN, PASSWORD);
      await expect(page.getByRole("navigation", { name: "Ana menü" })).toBeVisible();

      const legacy = await page.request.get(`${E2E_BASE_URL}/leader/reviews`, { maxRedirects: 0 });
      expect(legacy.status()).toBe(308);
      expect(new URL(legacy.headers()["location"] ?? "", E2E_BASE_URL).pathname).toBe("/fnb/team/reviews");

      await page.goto("/leader/reviews");
      await expect(page).toHaveURL(/\/fnb\/team\/reviews$/);
      await expect(page.getByRole("heading", { name: "Değerlendirmeler", level: 1 })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Ana menü" }).getByRole("link", { name: "Değerlendirmeler", exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );

      await page.getByRole("link", { name: new RegExp(EVENT_NAME) }).click();
      await page.waitForURL(/\/fnb\/team\/reviews\/[0-9a-f-]{36}$/);
      await expect(page.getByRole("listitem").filter({ hasText: NAMES.waiter })).toBeVisible();
      await expect(page.getByText(NAMES.supervisor)).toHaveCount(0);

      // Taşınan sayfaların sayfa yolu: "Ekip Panosu" ve "Ekibim".
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/fnb/team/members");
      const crumbs = page.getByRole("navigation", { name: "Sayfa yolu" });
      await expect(crumbs).toContainText("Ekip Panosu");
      await expect(crumbs).toContainText("Ekibim");
    } finally {
      await context.close();
    }
  });
});
