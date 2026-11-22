import { describe, expect, it, vi } from "vitest";
import {
  clearSignOutPending,
  isSignOutPending,
  markSignOutPending,
  runSignOut,
  classifySignOut,
  shouldBlockPath,
  type KeyValueStore,
} from "@/features/auth/sign-out";

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe("classifySignOut", () => {
  it.each([200, 204])("sunucu %i döndü: çıkış tamamlandı", (status) => {
    expect(classifySignOut({ kind: "response", status })).toBe("complete");
  });

  it("401: oturum zaten yok, tamamlandı sayılır", () => {
    expect(classifySignOut({ kind: "response", status: 401 })).toBe("complete");
  });

  it.each([400, 403, 429, 500, 502, 503])("%i: oturum sunucuda kapanmamış olabilir, ertelenir", (status) => {
    expect(classifySignOut({ kind: "response", status })).toBe("deferred");
  });

  it("ağ hatası: ertelenir", () => {
    expect(classifySignOut({ kind: "network-error" })).toBe("deferred");
  });
});

describe("bekleyen çıkış işareti", () => {
  it("işaretlenir, okunur ve temizlenir", () => {
    const store = memoryStore();
    expect(isSignOutPending(store)).toBe(false);
    markSignOutPending(store);
    expect(isSignOutPending(store)).toBe(true);
    clearSignOutPending(store);
    expect(isSignOutPending(store)).toBe(false);
  });

  it("depo yoksa veya hata fırlatırsa sessizce çalışır", () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(isSignOutPending(broken)).toBe(false);
    expect(() => markSignOutPending(broken)).not.toThrow();
    expect(() => clearSignOutPending(broken)).not.toThrow();
    expect(isSignOutPending(undefined)).toBe(false);
  });
});

describe("runSignOut", () => {
  it("tamamlanırsa işaret yoktur ve kabuk silinir", async () => {
    const store = memoryStore();
    const purge = vi.fn(async () => {});
    const outcome = await runSignOut({ request: async () => ({ kind: "response", status: 200 }), purge, store });
    expect(outcome).toBe("complete");
    expect(purge).toHaveBeenCalledOnce();
    expect(isSignOutPending(store)).toBe(false);
  });

  it("ağ yoksa: kabuk yine silinir, işaret konur, sonuç 'deferred'", async () => {
    const store = memoryStore();
    const purge = vi.fn(async () => {});
    const outcome = await runSignOut({ request: async () => ({ kind: "network-error" }), purge, store });
    expect(outcome).toBe("deferred");
    expect(purge).toHaveBeenCalledOnce();
    expect(isSignOutPending(store)).toBe(true);
  });

  it("kabuk silme hata verse de çıkış sürer", async () => {
    const store = memoryStore();
    const outcome = await runSignOut({
      request: async () => ({ kind: "network-error" }),
      purge: async () => {
        throw new Error("cache");
      },
      store,
    });
    expect(outcome).toBe("deferred");
    expect(isSignOutPending(store)).toBe(true);
  });

  it("bekleyen çıkış sonradan tamamlanınca işaret temizlenir", async () => {
    const store = memoryStore();
    markSignOutPending(store);
    const outcome = await runSignOut({ request: async () => ({ kind: "response", status: 200 }), purge: async () => {}, store });
    expect(outcome).toBe("complete");
    expect(isSignOutPending(store)).toBe(false);
  });
});

describe("shouldBlockPath", () => {
  it.each(["/", "/events", "/check-in/abc", "/admin/users"])("%s engellenir", (path) => {
    expect(shouldBlockPath(path)).toBe(true);
  });
  it.each(["/login", "/login/", "/i/abc", "/i"])("%s engellenmez (herkese açık)", (path) => {
    expect(shouldBlockPath(path)).toBe(false);
  });
  it("/loginx engellenir", () => {
    expect(shouldBlockPath("/loginx")).toBe(true);
  });
});
