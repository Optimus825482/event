import { expect, test } from "./support/fixtures";
import { createEvent } from "./support/ui";

// Tarayıcı Kıbrıs dışında bir saat diliminde olsa da form girilen duvar saatini Kıbrıs saati sayar.
test.use({ timezoneId: "America/New_York" });

const CASES = [
  { season: "kış (UTC+2)", input: "2030-01-15T20:00", dateText: /15 Ocak 2030/ },
  { season: "yaz (UTC+3)", input: "2030-07-15T20:00", dateText: /15 Temmuz 2030/ },
];

for (const { season, input, dateText } of CASES) {
  test(`etkinlik başlangıcı ${season}: girilen saat sayfada ve formda aynen görünür`, async ({ page }) => {
    const name = `E2E Saat Dilimi ${season} ${Date.now()}`;
    await createEvent(page, name, input);
    await expect(page.getByText(dateText).filter({ hasText: "20:00" }).first()).toBeVisible();
    // Düzenleme formu aynı duvar saatini gösterir (tarayıcı dilimine kaymaz).
    await expect(page.getByLabel("Başlangıç", { exact: true })).toHaveValue(input);
  });
}
