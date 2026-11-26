import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createFakeCore } from "../tests/helpers/fake-core";

const STATE_DIR = resolve(import.meta.dirname, ".state");

/** Sahte çekirdeği başlatır ve üç etkinliği koşu başında bir kez tohumlar (satis etkinlikleri 30 sn önbelleğe alır). */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const secret = process.env.SATIS_E2E_SECRET;
  if (!secret) throw new Error("SATIS_E2E_SECRET tanımlı değil");
  const port = Number(process.env.SATIS_FAKE_CORE_PORT ?? 3390);

  const core = createFakeCore({ secret });
  const gala = core.addEvent({ name: "Yılbaşı Galası", saleState: "open", demo: true });
  const bahar = core.addEvent({ name: "Bahar Konseri", saleState: "not_started", demo: true });
  const kapali = core.addEvent({ name: "Kapalı Gece", saleState: "closed", demo: true });
  const server = await core.listen(port);

  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(resolve(STATE_DIR, "fake.json"), JSON.stringify({ coreUrl: server.url, events: { gala, bahar, kapali } }));
  return () => server.close();
}
