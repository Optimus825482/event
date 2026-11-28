import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { FAKE_IMAGES, createFakeCore } from "../tests/helpers/fake-core";

// Paralel koşular birbirinin tohumunu ezmesin: SATIS_STATE_DIR ile ayrılabilir (varsayılan e2e/.state).
const STATE_DIR = resolve(import.meta.dirname, process.env.SATIS_STATE_DIR ?? ".state");

/** Sahte çekirdeği başlatır ve etkinlikleri koşu başında bir kez tohumlar (satis etkinlikleri 30 sn önbelleğe alır). */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const secret = process.env.SATIS_E2E_SECRET;
  if (!secret) throw new Error("SATIS_E2E_SECRET tanımlı değil");
  const port = Number(process.env.SATIS_FAKE_CORE_PORT ?? 3390);

  const core = createFakeCore({ secret });
  const galaStartsAt = "2027-01-15T18:00:00.000Z";
  const gala = core.addEvent({
    name: "Yılbaşı Galası",
    startsAt: galaStartsAt,
    saleState: "open",
    saleMode: "seat",
    demo: true,
    artistName: "Demo Sanatçı",
    coverImage: FAKE_IMAGES.cover,
    artistImage: FAKE_IMAGES.artist,
    site: {
      heroImage: FAKE_IMAGES.hero,
      summary: "Yılbaşı gecesine özel gala.",
      doorsOpenAt: new Date(Date.parse(galaStartsAt) - 90 * 60_000).toISOString(),
      ageLimit: "18+",
      dressCode: "Şık",
      sightlineSet: "diamond",
    },
  });
  const bahar = core.addEvent({ name: "Bahar Konseri", saleState: "not_started", demo: true });
  const kapali = core.addEvent({ name: "Kapalı Gece", saleState: "closed", demo: true });
  const masa = core.addEvent({ name: "Masa Bazlı Gece", saleState: "open", saleMode: "table", demo: true });
  const server = await core.listen(port);

  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(resolve(STATE_DIR, "fake.json"), JSON.stringify({ coreUrl: server.url, events: { gala, bahar, kapali, masa } }));
  return () => server.close();
}
