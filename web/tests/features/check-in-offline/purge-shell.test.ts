import { describe, expect, it } from "vitest";
import { purgeAuthenticatedShell, type PurgeEnv } from "@/features/check-in/offline/purge-shell";

function fakeCaches(names: string[]) {
  const deleted: string[] = [];
  return {
    deleted,
    api: {
      keys: async () => names,
      delete: async (name: string) => {
        deleted.push(name);
        return true;
      },
    },
  };
}

describe("purgeAuthenticatedShell (çıkışta kabuk önbelleği)", () => {
  it("worker'a purge mesajı gönderir ve yalnızca kabuk önbelleklerini siler", async () => {
    const messages: unknown[] = [];
    const store = fakeCaches(["eventflow-shell-v1", "eventflow-static-v1", "baska-uygulama"]);
    await purgeAuthenticatedShell({
      serviceWorker: { controller: { postMessage: (m) => messages.push(m) } },
      caches: store.api,
    });
    expect(messages).toEqual([{ type: "purge" }]);
    expect(store.deleted).toEqual(["eventflow-shell-v1"]);
  });

  it("service worker ya da Cache API yoksa sessizce biter", async () => {
    await expect(purgeAuthenticatedShell({})).resolves.toBeUndefined();
    await expect(purgeAuthenticatedShell({ serviceWorker: { controller: null } })).resolves.toBeUndefined();
  });

  it("postMessage ya da önbellek hatası çıkışı engellemez", async () => {
    const env: PurgeEnv = {
      serviceWorker: {
        controller: {
          postMessage: () => {
            throw new Error("worker kapalı");
          },
        },
      },
      caches: {
        keys: async () => {
          throw new Error("erişim yok");
        },
        delete: async () => false,
      },
    };
    await expect(purgeAuthenticatedShell(env)).resolves.toBeUndefined();
  });

  it("takılan önbellek çağrısı çıkışı süresiz bekletmez", async () => {
    const env: PurgeEnv = {
      caches: { keys: () => new Promise<string[]>(() => undefined), delete: async () => true },
    };
    const started = Date.now();
    await purgeAuthenticatedShell(env);
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});
