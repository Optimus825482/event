import path from "node:path";

import { test as base, expect, type Page } from "@playwright/test";

import { watchCspViolations } from "./csp";
import { ADMIN_USERNAME, AUTH_STATE_FILE } from "./constants";

export { expect };
export const ADMIN_STATE = path.resolve(import.meta.dirname, "../..", AUTH_STATE_FILE);
export const EMPTY_STATE = { cookies: [], origins: [] };

export function adminPassword(): string {
  const value = process.env.E2E_ADMIN_PASSWORD;
  if (!value) throw new Error("E2E_ADMIN_PASSWORD tanımlı değil");
  return value;
}

export const adminUsername = ADMIN_USERNAME;

/**
 * Her testte yakalanmamış tarayıcı hataları ve CSP ihlallerinı (pageerror) toplar ve test sonunda boş olmasını ister;
 * konsol hataları ek olarak testin ek dosyalarına yazılır (başarısızlığa yol açmaz).
 */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ context }, use, testInfo) => {
      const errors: string[] = [];
      const consoleErrors: string[] = [];
      const watch = (page: Page) => {
        page.on("pageerror", (e) => errors.push(`${page.url()} :: ${e.message}`));
        watchCspViolations(page, errors);
        page.on("console", (m) => {
          if (m.type() === "error") consoleErrors.push(`${page.url()} :: ${m.text()}`);
        });
      };
      context.pages().forEach(watch);
      context.on("page", watch);
      await use(errors);
      if (consoleErrors.length > 0) {
        await testInfo.attach("console-errors", { body: consoleErrors.join("\n"), contentType: "text/plain" });
      }
      expect(errors, "yakalanmamış tarayıcı hataları ve CSP ihlalleri").toEqual([]);
    },
    { auto: true },
  ],
});

export async function loginAs(page: Page, username: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Kullanıcı adı").fill(username);
  await page.getByLabel("Parola").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
}
