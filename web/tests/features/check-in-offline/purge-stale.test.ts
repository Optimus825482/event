import { describe, expect, it } from "vitest";
import { createMemoryStore, purgeStaleItems } from "@/features/check-in/offline/flusher";
import { POST_EVENT_RETENTION_MS, STALE_ITEM_MS, staleKeys } from "@/features/check-in/offline/queue-core";
import { item } from "./helpers";

const NOW = 10 * STALE_ITEM_MS;

describe("süresi geçmiş kuyruk öğeleri", () => {
  it("48 saati aşanları seçer, sınırdakini ve yenileri korur", () => {
    const old = item({ now: NOW - STALE_ITEM_MS - 1 });
    const edge = item({ now: NOW - STALE_ITEM_MS });
    const fresh = item({ now: NOW - 1_000 });
    expect(staleKeys([old, edge, fresh], NOW)).toEqual([old.idempotencyKey]);
  });

  describe("etkinlik bitişine göre (eventEndsAt)", () => {
    const ends = Date.UTC(2030, 5, 15, 22, 0, 0);
    const endsIso = new Date(ends).toISOString();
    // enqueuedAt çok yeni: yaş ölçütü devreye girse bile bitiş kuralı belirleyici olmalı.
    const mk = (now: number) => item({ now, eventEndsAt: endsIso });

    it("bitiş + 1 saatten önce korur", () => {
      const it = mk(ends - 1_000);
      expect(staleKeys([it], ends + POST_EVENT_RETENTION_MS - 1)).toEqual([]);
    });

    it("bitiş + 1 saatte ve sonrasında siler", () => {
      const it = mk(ends - 1_000);
      expect(staleKeys([it], ends + POST_EVENT_RETENTION_MS)).toEqual([it.idempotencyKey]);
      expect(staleKeys([it], ends + POST_EVENT_RETENTION_MS + 1)).toEqual([it.idempotencyKey]);
    });

    it("yeni eklenmiş öğeyi de bitiş + 1 saat geçince siler (48 saat dolmadan)", () => {
      const it = mk(ends + 30 * 60_000);
      expect(staleKeys([it], ends + POST_EVENT_RETENTION_MS)).toEqual([it.idempotencyKey]);
    });

    it("eventEndsAt yoksa 48 saatlik yaş yedeğini kullanır", () => {
      const legacy = item({ now: 1_000 });
      expect(legacy.eventEndsAt).toBeUndefined();
      expect(staleKeys([legacy], 1_000 + STALE_ITEM_MS)).toEqual([]);
      expect(staleKeys([legacy], 1_000 + STALE_ITEM_MS + 1)).toEqual([legacy.idempotencyKey]);
    });

    it("çözümlenemeyen eventEndsAt yaş yedeğine düşer", () => {
      const bad = item({ now: 1_000, eventEndsAt: "bozuk" });
      expect(staleKeys([bad], 1_000 + STALE_ITEM_MS)).toEqual([]);
      expect(staleKeys([bad], 1_000 + STALE_ITEM_MS + 1)).toEqual([bad.idempotencyKey]);
    });

    it("purgeStaleItems bitişi geçmiş öğeyi siler, sürenin içindekini korur", async () => {
      const store = createMemoryStore();
      const gone = mk(ends - 1_000);
      const kept = item({ now: ends - 1_000, eventEndsAt: new Date(ends + 3 * 60 * 60_000).toISOString() });
      await store.putMany([gone, kept]);
      expect(await purgeStaleItems(store, ends + POST_EVENT_RETENTION_MS)).toEqual([gone.idempotencyKey]);
    });
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
