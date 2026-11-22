import { describe, expect, it } from "vitest";
import { createFlusher, createMemoryStore, type QueueStore } from "@/features/check-in/offline/flusher";
import type { BatchOutcome, QueueItem, SettledEvent } from "@/features/check-in/offline/queue-core";
import { item, success } from "./helpers";

function okFor(items: readonly QueueItem[]): BatchOutcome {
  return {
    kind: "results",
    results: items.map((i) => ({ idempotencyKey: i.idempotencyKey, result: { ok: true, data: success(i.idempotencyKey) } })),
  };
}

/** Web Locks benzeri: kilit doluysa fonksiyon çalışmaz ve `false` döner. */
function createTryLock() {
  let held = false;
  return async (fn: () => Promise<void>): Promise<boolean> => {
    if (held) return false;
    held = true;
    try {
      await fn();
      return true;
    } finally {
      held = false;
    }
  };
}

function setup(send: (items: readonly QueueItem[]) => Promise<BatchOutcome>, store: QueueStore = createMemoryStore()) {
  const events: SettledEvent[] = [];
  let clock = 10_000;
  const flusher = createFlusher({
    store,
    send,
    now: () => clock,
    random: () => 0.5,
    tryLock: createTryLock(),
    onEvents: (e) => events.push(...e),
    maxBatch: 2,
  });
  return {
    store,
    events,
    flusher,
    advance(ms: number) {
      clock += ms;
    },
  };
}

describe("flusher", () => {
  it("öğeleri sırayla, en çok maxBatch'lik gruplarla gönderir; başarılı öğeler kuyruktan çıkar", async () => {
    const batches: string[][] = [];
    const { store, flusher, events } = setup(async (items) => {
      batches.push(items.map((i) => i.idempotencyKey));
      return okFor(items);
    });
    const all = [item({ now: 1 }), item({ now: 2 }), item({ now: 3 })];
    await store.putMany(all);
    await flusher.flush();
    expect(batches).toEqual([[all[0]!.idempotencyKey, all[1]!.idempotencyKey], [all[2]!.idempotencyKey]]);
    expect(await store.getAll()).toEqual([]);
    expect(events.filter((e) => e.type === "done")).toHaveLength(3);
  });

  it("iki eşzamanlı flush çağrısı her öğeyi yalnızca bir kez gönderir", async () => {
    let calls = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const store = createMemoryStore();
    // Kilit hep açık: yalnızca sekme içi "tek boşaltma" koruması sınanır.
    const flusher = createFlusher({
      store,
      now: () => 10_000,
      random: () => 0,
      tryLock: async (fn) => {
        await fn();
        return true;
      },
      send: async (items) => {
        calls += 1;
        await gate;
        return okFor(items);
      },
    });
    await store.putMany([item(), item()]);
    const first = flusher.flush();
    const second = flusher.flush();
    release();
    await Promise.all([first, second]);
    expect(calls).toBe(1);
    expect(await store.getAll()).toEqual([]);
  });

  it("iki sekme (ortak depo + kilit): ikinci sekme kilidi alamaz ve gönderim yapmaz", async () => {
    const store = createMemoryStore();
    const tryLock = createTryLock();
    const sent: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const make = (wait: boolean) =>
      createFlusher({
        store,
        tryLock,
        now: () => 10_000,
        random: () => 0,
        send: async (items) => {
          sent.push(...items.map((i) => i.idempotencyKey));
          if (wait) await gate;
          return okFor(items);
        },
      });
    const a = item();
    await store.putMany([a]);
    const tabA = make(true);
    const tabB = make(false);
    const pa = tabA.flush();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    await tabB.flush();
    release();
    await pa;
    expect(sent).toEqual([a.idempotencyKey]);
  });

  it("ağ hatasında durur, öğe aynı anahtarla kalır; zamanı gelince aynı anahtar yeniden gönderilir", async () => {
    const seen: string[] = [];
    let fail = true;
    const { store, flusher, advance, events } = setup(async (items) => {
      seen.push(...items.map((i) => i.idempotencyKey));
      return fail ? { kind: "network" } : okFor(items);
    });
    const a = item();
    await store.putMany([a]);
    await flusher.flush();
    expect(seen).toEqual([a.idempotencyKey]);
    const [stored] = await store.getAll();
    expect(stored).toMatchObject({ status: "pending", idempotencyKey: a.idempotencyKey, attempts: 1 });
    expect(events.map((e) => e.type)).toEqual(["deferred"]);

    await flusher.flush(); // geri çekilme dolmadı
    expect(seen).toHaveLength(1);

    fail = false;
    advance(120_000);
    await flusher.flush();
    expect(seen).toEqual([a.idempotencyKey, a.idempotencyKey]);
    expect(await store.getAll()).toEqual([]);
  });

  it("send fırlatırsa öğeler sending'de takılmaz", async () => {
    const { store, flusher } = setup(async () => {
      throw new Error("beklenmeyen");
    });
    await store.putMany([item()]);
    await flusher.flush();
    const [stored] = await store.getAll();
    expect(stored?.status).toBe("pending");
  });

  it("401: kuyruk duraklar, öğe silinmez, resume sonrası gönderilir", async () => {
    let status: BatchOutcome = { kind: "unauthenticated" };
    let calls = 0;
    const { store, flusher } = setup(async (items) => {
      calls += 1;
      return status.kind === "unauthenticated" ? status : okFor(items);
    });
    await store.putMany([item(), item(), item()]);
    await flusher.flush();
    expect(flusher.isPaused()).toBe(true);
    expect(await store.getAll()).toHaveLength(3);
    await flusher.flush();
    expect(calls).toBe(1);

    status = { kind: "network" };
    flusher.resume();
    status = okFor([]);
    await flusher.flush();
    expect(flusher.isPaused()).toBe(false);
    expect(await store.getAll()).toHaveLength(0);
  });

  it("kalıcı hata alan öğe saklanır; sonraki öğeler gönderilmeye devam eder", async () => {
    const a = item({ now: 1 });
    const b = item({ now: 2 });
    const { store, flusher } = setup(async (items) => ({
      kind: "results",
      results: items.map((i) =>
        i.idempotencyKey === a.idempotencyKey
          ? { idempotencyKey: i.idempotencyKey, result: { ok: false as const, code: "conflict", message: "iptal" } }
          : { idempotencyKey: i.idempotencyKey, result: { ok: true as const, data: success() } },
      ),
    }));
    await store.putMany([a, b]);
    await flusher.flush();
    const left = await store.getAll();
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ idempotencyKey: a.idempotencyKey, status: "failed" });
  });

  it("yarıda kalmış (sending) öğeyi kurtarır ve aynı anahtarla yeniden gönderir", async () => {
    const seen: string[] = [];
    const { store, flusher } = setup(async (items) => {
      seen.push(...items.map((i) => i.idempotencyKey));
      return okFor(items);
    });
    const a = { ...item(), status: "sending" as const, attempts: 1 };
    await store.putMany([a]);
    await flusher.flush();
    expect(seen).toEqual([a.idempotencyKey]);
  });
});
