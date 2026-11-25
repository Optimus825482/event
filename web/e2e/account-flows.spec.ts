import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

import type { Browser, Page } from "@playwright/test";

import { deleteSessionsOf, withDb } from "./support/db";
import { EMPTY_STATE, expect, loginAs, test } from "./support/fixtures";
import { createEvent } from "./support/ui";

const suffix = () => randomBytes(3).toString("hex");
const randomPassword = () => `Hp-${randomBytes(12).toString("base64url")}`;

/** Yönetici arayüzünden bir kullanıcı oluşturur (yalnızca check-in izni olan Casino kullanıcısı). */
async function createUserViaUi(page: Page, username: string, name: string, password: string): Promise<void> {
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Yeni kullanıcı" }).click();
  await page.getByLabel("Kullanıcı adı", { exact: true }).fill(username);
  await page.getByLabel("Ad soyad").fill(name);
  // Yalnızca check-in izni olan Casino kullanıcısı.
  await page.getByLabel("Rol", { exact: true }).selectOption({ label: "Departman kullanıcısı" });
  await page.getByLabel("Casino", { exact: true }).check();
  await page.getByLabel("Check-in: Görüntüle", { exact: true }).check();
  await page.getByLabel("Check-in: Oluştur", { exact: true }).check();
  await page.getByLabel("Parola", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Kullanıcı oluştur" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Kullanıcı oluşturuldu" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: username })).toBeVisible();
}

/** Giriş yapar; hız sınırına (429) takılırsa bekleme süresi dolunca yeniden dener. Sonuç: menü göründü mü. */
async function signIn(page: Page, username: string, password: string): Promise<boolean> {
  const nav = page.getByRole("navigation", { name: "Ana menü" });
  const bad = page.getByRole("alert").filter({ hasText: "Kullanıcı adı veya parola hatalı" });
  const limited = page.getByRole("alert").filter({ hasText: "Çok fazla deneme yapıldı" });
  for (let attempt = 0; attempt < 6; attempt++) {
    await loginAs(page, username, password);
    await nav.or(bad).or(limited).first().waitFor();
    if (await nav.isVisible()) return true;
    if (await bad.isVisible()) return false;
    await page.waitForTimeout(4_000);
  }
  throw new Error("Hız sınırı nedeniyle giriş yapılamadı");
}

/** Boş oturumlu yeni bağlamda kullanıcı olarak giriş yapar ve menünün yüklenmesini bekler. */
async function openAs(browser: Browser, username: string, password: string) {
  const context = await browser.newContext({ storageState: EMPTY_STATE });
  const page = await context.newPage();
  expect(await signIn(page, username, password), "giriş başarılı olmalı").toBe(true);
  return { context, page };
}

/** `size`×`size` düz renkli geçerli bir PNG üretir (bağımlılıksız). */
function solidPng(size: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = (crcTable[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc(body));
    return Buffer.concat([head, body, tail]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit derinliği
  ihdr[9] = 2; // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3, 0x9a)]);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

test.describe("Hesap akışları", () => {
  test("yönetici kullanıcıyı ayrıntı sayfasından siler: listeden kalkar ve giriş yapamaz", async ({ page, browser }) => {
    const username = `e2e-sil-${suffix()}`;
    const password = randomPassword();
    await createUserViaUi(page, username, "Silinecek Kişi", password);

    await page.getByRole("link", { name: `${username} ayrıntıları ve izinleri` }).click();
    await expect(page.getByRole("heading", { name: username, level: 1 })).toBeVisible();
    await page.getByRole("button", { name: `${username} kullanıcısını sil` }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Kullanıcı silinsin mi?");
    await dialog.getByRole("button", { name: "Sil" }).click();

    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.getByRole("heading", { name: "Kullanıcılar", level: 1 })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: username })).toHaveCount(0);

    const context = await browser.newContext({ storageState: EMPTY_STATE });
    try {
      const guest = await context.newPage();
      expect(await signIn(guest, username, password), "silinen kullanıcı giriş yapamamalı").toBe(false);
      await expect(guest).toHaveURL(/\/login/);
    } finally {
      await context.close();
    }
  });

  test("profil fotoğrafı yüklenir ve kaldırılır", async ({ page, browser }) => {
    const username = `e2e-foto-${suffix()}`;
    const password = randomPassword();
    await createUserViaUi(page, username, "Fotoğraf Kişisi", password);

    const { context, page: me } = await openAs(browser, username, password);
    try {
      await me.goto("/profile");
      await expect(me.getByText("Fotoğraf Kişisi", { exact: true })).toBeVisible();
      await expect(me.getByRole("img", { name: "Fotoğraf Kişisi profil fotoğrafı" })).toHaveCount(0);

      await me.locator('input[type="file"]').setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: solidPng(64) });
            const avatar = me.getByRole("img", { name: "Fotoğraf Kişisi profil fotoğrafı" });
      await expect(avatar).toBeVisible();
      await expect(avatar).toHaveAttribute("src", /^data:image\/(webp|jpeg);base64,/);
      await expect(me.getByRole("button", { name: "Fotoğrafı değiştir" })).toBeVisible();

      await me.getByRole("button", { name: "Fotoğrafı kaldır" }).click();
            await expect(me.getByRole("img", { name: "Fotoğraf Kişisi profil fotoğrafı" })).toHaveCount(0);
      await expect(me.getByRole("button", { name: "Fotoğraf yükle" })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("kendi parolasını değiştirme: yanlış mevcut parola hata verir, doğrusu yeni parolayla girişi sağlar", async ({ page, browser }) => {
    const username = `e2e-parola-${suffix()}`;
    const password = randomPassword();
    const next = randomPassword();
    await createUserViaUi(page, username, "Parola Kişisi", password);

    const { context, page: me } = await openAs(browser, username, password);
    try {
      await me.goto("/profile");
      await me.getByLabel("Mevcut parola").fill(randomPassword());
      await me.getByLabel("Yeni parola", { exact: true }).fill(next);
      await me.getByLabel("Yeni parola (tekrar)").fill(next);
      await me.getByRole("button", { name: "Parolayı değiştir" }).click();
      await expect(me.getByText("Mevcut parola hatalı").first()).toBeVisible();

      await me.getByLabel("Mevcut parola").fill(password);
      await me.getByRole("button", { name: "Parolayı değiştir" }).click();
      await expect(me.getByRole("status").filter({ hasText: "Parolanız değiştirildi" }).first()).toBeVisible();
    } finally {
      await context.close();
    }

    // Eski parola artık geçersiz, yenisi giriş yapar.
    const old = await browser.newContext({ storageState: EMPTY_STATE });
    try {
      const oldPage = await old.newPage();
      expect(await signIn(oldPage, username, password), "eski parola geçersiz olmalı").toBe(false);
    } finally {
      await old.close();
    }
    const fresh = await openAs(browser, username, next);
    await fresh.context.close();
  });

  test("personel CSV içe aktarma: önizleme, onay ve listede görünme", async ({ page }, testInfo) => {
    const tag = suffix().toUpperCase();
    const sicil1 = `E2E-${tag}-1`;
    const sicil2 = `E2E-${tag}-2`;
    const csv = [
      "Sicil No;İsim Soyisim;E-posta",
      `${sicil1};Csv Personel Bir ${tag};bir-${tag}@example.com`,
      `${sicil2};Csv Personel İki ${tag};`,
    ].join("\n");
    const file = testInfo.outputPath("personel.csv");
    writeFileSync(file, `﻿${csv}\n`, "utf8");

    await page.goto("/staff");
    await page.getByRole("button", { name: "CSV içe aktar" }).click();
    const dialog = page.getByRole("dialog", { name: "Toplu personel içe aktar" });
    await dialog.locator('input[type="file"]').setInputFiles(file);
    await expect(dialog.getByRole("status")).toContainText("2 uygun, 0 yinelenen, 0 hatalı satır");
    await expect(dialog.getByRole("row")).toHaveCount(3);
    const before = await withDb((pool) => pool.query("select 1 from staff where sicil_no = $1", [sicil1]));
    expect(before.rowCount).toBe(0);

    await dialog.getByRole("button", { name: "2 satırı içe aktar" }).click();
    await expect(dialog.getByRole("status")).toContainText("2 personel eklendi");

    await page.goto(`/staff?search=${encodeURIComponent(`E2E-${tag}`)}`);
    await expect(page.getByText("2 kişi listeleniyor")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: sicil1 })).toContainText(`Csv Personel Bir ${tag}`);
    await expect(page.getByRole("row").filter({ hasText: sicil2 })).toContainText(`Csv Personel İki ${tag}`);
  });

  test("Güvenlik sekmesi: etkin oturumlar listelenir ve başka bir oturum kapatılır", async ({ page, browser }) => {
    const username = `e2e-oturum-${suffix()}`;
    const password = randomPassword();
    await createUserViaUi(page, username, "Oturum Kişisi", password);
    await deleteSessionsOf(username);

    // İkinci bir tarayıcı bağlamıyla kullanıcının oturumu açılır.
    const other = await openAs(browser, username, password);
    try {
      await page.goto("/admin/settings");
      await page.getByRole("tab", { name: "Güvenlik" }).click();
      await expect(page.getByText("Etkin oturumlar", { exact: true })).toBeVisible();
      const row = page.getByRole("row").filter({ hasText: `@${username}` });
      await expect(row).toHaveCount(1);
      await expect(page.getByRole("row").filter({ hasText: "(bu oturum)" })).toHaveCount(1);

      await row.getByRole("button", { name: `${username} oturumunu kapat` }).click();
      await expect(page.getByRole("row").filter({ hasText: `@${username}` })).toHaveCount(0);

      // Kapatılan oturum sunucu tarafında geçersizdir.
      await other.page.goto("/profile");
      await expect(other.page).toHaveURL(/\/login/);
    } finally {
      await other.context.close();
    }
  });

  test("ekip organizasyonu: servis noktası penceresinde rol başına gereken sayı kaydedilir", async ({ page }) => {
    const tag = suffix();
    const pointName = `Bar ${tag}`;
    const eventId = await createEvent(page, `E2E Servis Noktası ${tag}`);
    // Servis noktası oluşturan bir arayüz yok (şablondan gelir); doğrudan veritabanına eklenir.
    await withDb((pool) => pool.query("insert into service_points (event_id, name, point_type, required_staff_count) values ($1, $2, 'bar', 3)", [eventId, pointName]));

    await page.goto(`/events/${eventId}/team-organization`);
    await page.getByRole("button", { name: /Personel Atama/ }).click();
    await expect(page.getByText(pointName)).toBeVisible();
    await page.getByRole("button", { name: `${pointName} personeli` }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`${pointName} — Personel`);

    await dialog.getByRole("button", { name: "Barmen görevi ekle" }).click();
    const count = dialog.getByLabel("Barmen gerekli sayı");
    await expect(count).toHaveValue("1");
    await count.fill("3");
    await expect(dialog.getByLabel("Barmen atanan / gereken")).toHaveText("0 / 3");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    await page.getByRole("button", { name: /Özet ve Kaydet/ }).click();
    await page.getByRole("button", { name: "Tümünü kaydet" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Organizasyon kaydedildi." })).toBeVisible();

    const saved = await withDb((pool) =>
      pool.query<{ role: string; required_count: number }>(
        "select r.role, r.required_count from service_point_role_requirements r join service_points p on p.id = r.service_point_id where p.event_id = $1 and p.name = $2",
        [eventId, pointName],
      ),
    );
    expect(saved.rows).toEqual([{ role: "barman", required_count: 3 }]);

    // Yeniden yüklemede sayı korunur.
    await page.reload();
    await page.getByRole("button", { name: /Personel Atama/ }).click();
    await page.getByRole("button", { name: `${pointName} personeli` }).click();
    await expect(page.getByRole("dialog").getByLabel("Barmen gerekli sayı")).toHaveValue("3");
  });
});
