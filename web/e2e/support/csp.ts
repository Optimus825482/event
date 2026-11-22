import type { Page } from "@playwright/test";

const CSP_MESSAGE = /Content Security Policy|Refused to|violates the following/i;

/** Tarayıcı konsoluna düşen her CSP ihlalini `sink`'e ekler (test sonunda boş olması beklenir). */
export function watchCspViolations(page: Page, sink: string[]): void {
  page.on("console", (message) => {
    const text = message.text();
    if (CSP_MESSAGE.test(text)) sink.push(`CSP ihlali ${page.url()} :: ${text}`);
  });
}
