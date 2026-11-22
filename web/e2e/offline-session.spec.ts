import { adminPassword, adminUsername, expect, test } from "./support/fixtures";
import { invitationLink } from "./support/invitation";
import { checkInKeys, qrTokenFor, reservationsByGuest } from "./support/db";
import {
  cachedApiUrls,
  createDoorUser,
  expectPending,
  openConsoleAndWarm,
  openDevice,
  scanCode,
  seedEvent,
  shellKeys,
  signIn,
  signOut,
  type OfflineFixture,
} from "./support/offline";

// Ortak cihaz: çıkış sonrası kabuk önbelleği ve başka kullanıcının bekleyen girişleri.
test.describe.configure({ mode: "serial" });

const STAMP = Date.now().toString(36);
const EVENT_NAME = `Oturum Gala ${STAMP}`;
const OWNER_GUEST = "Sahip A Misafir";
const DOOR_USER = `kapi-${STAMP}`;

let fixture: OfflineFixture;
let doorPassword = "";

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  fixture = await seedEvent(browser, { eventName: EVENT_NAME, guests: [OWNER_GUEST], freeTables: 0 });
  const errors: string[] = [];
  const { context, page } = await openDevice(browser, { session: fixture.admin, errors });
  try {
    doorPassword = await createDoorUser(page, DOOR_USER);
  } finally {
    await context.close();
  }
});

test("ikinci kullanıcı aynı cihazda: A'nın bekleyen girişi B oturumunda gönderilmez, ayrı tutulur, A dönünce gönderilir", async ({ browser }) => {
  const errors: string[] = [];
  const { context, page } = await openDevice(browser, { session: fixture.admin, errors });
  try {
    await openConsoleAndWarm(page, fixture.eventId, EVENT_NAME);

    // A'nın girişi sunucuya ulaşamaz (istek düşer) ve kuyrukta kalır; sonra A çıkış yapar.
    let blocked = true;
    await context.route("**/api/check-in", (route) => (blocked ? route.abort("connectionreset") : route.continue()));
    await scanCode(page, await qrTokenFor(OWNER_GUEST));
    await expect(page.getByRole("status").filter({ hasText: "kuyruğa alındı" })).toBeVisible();
    await expectPending(page, 1);
    await signOut(page);

    // B aynı cihazda oturum açar.
    await signIn(page, DOOR_USER, doorPassword);
    const posts: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().endsWith("/api/check-in")) posts.push(r.postData() ?? "");
    });
    await page.goto(`/check-in/${fixture.eventId}`);
    await expect(page.getByRole("heading", { name: EVENT_NAME, level: 1 })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "1 başka kullanıcıya ait bekleyen giriş var" })).toBeVisible();
    await expectPending(page, 0);

    // Ağ düzelir ve boşaltma tetiklenir: B'nin kendi öğesi yoktur, A'nınki B adına GÖNDERİLMEZ.
    blocked = false;
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await page.waitForTimeout(2_500);
    expect(posts).toEqual([]);
    const [guest] = await reservationsByGuest(OWNER_GUEST);
    expect(guest?.status).toBe("confirmed");
    expect(await checkInKeys(guest?.id ?? "")).toEqual([]);
    await expect(page.getByRole("alert").filter({ hasText: "1 başka kullanıcıya ait bekleyen giriş var" })).toBeVisible();

    // Sahibi (A) dönünce öğe kaybolmamıştır ve gönderilir.
    await signOut(page);
    await signIn(page, adminUsername, adminPassword());
    await page.goto(`/check-in/${fixture.eventId}`);
    await expectPending(page, 0);
    await expect.poll(async () => (await reservationsByGuest(OWNER_GUEST))[0]?.status).toBe("checked_in");
    expect(await checkInKeys(guest?.id ?? "")).toHaveLength(1);
    await expect(page.getByRole("alert").filter({ hasText: "başka kullanıcıya ait" })).toHaveCount(0);
  } finally {
    await context.close();
  }
  expect(errors, "yakalanmamış tarayıcı hataları").toEqual([]);
});

test("çıkış, önbellekteki kimlik doğrulamalı kabuğu siler: çıkıştan sonra çevrimdışı /check-in/<id> açılmaz", async ({ browser }) => {
  const errors: string[] = [];
  // Önceki test A'yı çıkış yaptırdı (oturum sunucuda iptal); bu cihaz yeniden giriş yapar.
  const { context, page } = await openDevice(browser, { errors });
  const consolePath = `/check-in/${fixture.eventId}`;
  try {
    await signIn(page, adminUsername, adminPassword());
    await openConsoleAndWarm(page, fixture.eventId, EVENT_NAME);
    expect(await cachedApiUrls(page)).toEqual([]);

    // Kontrol: oturum açıkken çevrimdışı gezinme önbellekteki kabuğu açar.
    await context.setOffline(true);
    await page.goto(consolePath);
    await expect(page.getByRole("heading", { name: EVENT_NAME, level: 1 })).toBeVisible();
    await context.setOffline(false);

    await signOut(page);
    expect(await shellKeys(page)).toEqual([]);

    // Çıkıştan sonra aynı adres çevrimdışı açılmaz: kimlikli kabuk yok, genel çevrimdışı sayfası var.
    await context.setOffline(true);
    await page.goto(consolePath);
    await expect(page.getByRole("heading", { name: "Çevrimdışısınız" })).toBeVisible();
    await expect(page.getByRole("heading", { name: EVENT_NAME })).toHaveCount(0);
    await expect(page.getByText(EVENT_NAME)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Çıkış yap" })).toHaveCount(0);
    await context.setOffline(false);
  } finally {
    await context.close();
  }
  expect(errors, "yakalanmamış tarayıcı hataları").toEqual([]);
});

test("çevrimdışı çıkış: kabuk silinir, arayüz kilitlenir, bağlantı gelince sunucu çıkışı tamamlanır", async ({ browser }) => {
  const errors: string[] = [];
  const { context, page } = await openDevice(browser, { errors });
  const consolePath = `/check-in/${fixture.eventId}`;
  try {
    await signIn(page, adminUsername, adminPassword());
    await openConsoleAndWarm(page, fixture.eventId, EVENT_NAME);

    await context.setOffline(true);
    await page.getByRole("button", { name: "Çıkış yap" }).click();
    const blocker = page.getByRole("alertdialog", { name: "Çıkış tamamlanamadı" });
    await expect(blocker).toBeVisible();
    await expect(blocker).toContainText("Bağlantı gelince çıkış otomatik olarak tamamlanacak");
    // Altındaki sayfa etkileşime kapalıdır ve kimlikli kabuk önbelleği silinmiştir.
    await expect(page.locator("#app-root")).toHaveAttribute("inert", "");
    expect(await shellKeys(page)).toEqual([]);

    // Yeniden yükleme (hâlâ çevrimdışı): önbellekteki kabuk açılmaz.
    await page.goto(consolePath);
    await expect(page.getByRole("heading", { name: EVENT_NAME })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Çevrimdışısınız" })).toBeVisible();

    // Bağlantı gelir: bekleyen çıkış tamamlanır, oturum sunucuda kapanır.
    await context.setOffline(false);
    await page.goto(consolePath);
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/events");
    await expect(page).toHaveURL(/\/login/);
    expect(await page.evaluate(() => window.localStorage.getItem("eventflow-signout-pending"))).toBeNull();
  } finally {
    await context.close();
  }
  expect(errors, "yakalanmamış tarayıcı hataları ve CSP ihlalleri").toEqual([]);
});

test("üretim CSP'si: unsafe-eval yok, upgrade-insecure-requests var, sayfa yanıtında başlık mevcut", async ({ browser }) => {
  const errors: string[] = [];
  const { context, page } = await openDevice(browser, { session: fixture.admin, errors });
  try {
    // 404 ve geçersiz davet bağlantısı da CSP ihlali üretmemeli (statik ön üretilmiş sayfa olmamalı).
    await page.goto("/yok-boyle-bir-sayfa");
    await expect(page.getByRole("heading", { name: "Sayfa bulunamadı" })).toBeVisible();
    await page.goto("/i/gecersiz-belirtec");
    await page.waitForLoadState("networkidle");
    // Gerçek davetiye (kullanıcı tasarımlı satır içi stiller, veri URL'li QR görseli, /i/.../image): CSP'yi gevşetmeden açılır.
    const [owner] = await reservationsByGuest(OWNER_GUEST);
    await page.goto(invitationLink(owner?.id ?? "", fixture.eventId));
    await expect(page.getByRole("img", { name: "Giriş QR kodu" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Davetiye" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const response = await page.goto("/login");
    const csp = response?.headers()["content-security-policy"] ?? "";
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  } finally {
    await context.close();
  }
  expect(errors, "yakalanmamış tarayıcı hataları ve CSP ihlalleri").toEqual([]);
});
