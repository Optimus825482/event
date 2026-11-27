import { describe, expect, it } from "vitest";
import { createMemoryStore, purgeStaleItems } from "@/features/check-in/offline/flusher";
import { STALE_ITEM_MS, staleKeys } from "@/features/check-in/offline/queue-core";
import { item } from "./helpers";

const NOW = 10 * STALE_ITEM_MS;

describe("süresi geçmiş kuyruk öğeleri", () => {
  it("48 saati aşanları seçer, sınırdakini ve yenileri korur", () => {
    const old = item({ now: NOW - STALE_ITEM_MS - 1 });
    const edge = item({ now: NOW - STALE_ITEM_MS });
    const fresh = item({ now: NOW - 1_000 });
    expect(staleKeys([old, edge, fresh], NOW)).toEqual([old.idempotencyKey]);
  });

  it("purgeStaleItems yalnızca eski öğeleri depodan siler", async () => {
    const store = createMemoryStore();
    const old = item({ now: NOW - STALE_ITEM_MS - 1, token: "eski.belirtec" });
    const fresh = item({ now: NOW - 5_000 });
    await store.putMany([old, fresh]);

    expect(await purgeStaleItems(store, NOW)).toEqual([old.idempotencyKey]);
    expect((await store.getAll()).map((i) => i.idempotencyKey)).toEqual([fresh.idempotencyKey]);
  });

  it("boş depoda hiçbir şey yapmaz", async () => {
    expect(await purgeStaleItems(createMemoryStore(), NOW)).toEqual([]);
  });
});
