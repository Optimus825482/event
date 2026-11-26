import type { Browser, BrowserContext, Page } from "@playwright/test";

import { EMPTY_STATE, expect, loginAs } from "./fixtures";

export type Dept = { username: string; fullName: string; label: string };

/** Yönetici oturumuyla "Yeni kullanıcı" penceresinden bir departman yöneticisi oluşturur. */
export async function createManager(admin: Page, dept: Dept, password: string): Promise<void> {
  await admin.goto("/admin/users");
  await admin.getByRole("button", { name: "Yeni kullanıcı" }).click();
  await admin.getByLabel("Kullanıcı adı", { exact: true }).fill(dept.username);
  await admin.getByLabel("Ad soyad").fill(dept.fullName);
  await admin.getByLabel("Rol", { exact: true }).selectOption({ label: "Departman kullanıcısı" });
  await admin.getByLabel(dept.label, { exact: true }).check();
  await admin.getByLabel(`${dept.label} düzeyi`).selectOption({ label: "Yönetici" });
  await admin.getByLabel("Parola", { exact: true }).fill(password);
  await admin.getByRole("button", { name: "Kullanıcı oluştur" }).click();
  await expect(admin.getByRole("status").filter({ hasText: "Kullanıcı oluşturuldu" })).toBeVisible();
}

/** Temiz bir tarayıcı bağlamında departman yöneticisiyle oturum açar; bağlamı kapatmak çağıranındır. */
export async function openSession(
  browser: Browser,
  dept: Dept,
  password: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ storageState: EMPTY_STATE });
  const page = await context.newPage();
  await loginAs(page, dept.username, password);
  await expect(page.getByRole("navigation", { name: "Ana menü" })).toBeVisible();
  return { context, page };
}
