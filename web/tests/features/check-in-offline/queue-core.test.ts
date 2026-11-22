import { describe, expect, it } from "vitest";
import {
  applyOutcome,
  backoffMs,
  claim,
  heldAside,
  ownedBy,
  recoverInterrupted,
  retryFailed,
  selectDue,
  summarize,
  type BatchOutcome,
  type QueueItem,
} from "@/features/check-in/offline/queue-core";
import { item, OTHER_USER_ID, success, USER_ID } from "./helpers";

function claimed(items: QueueItem[], now = 2_000): QueueItem[] {
  return claim(selectDue(items, now, 50), now);
}

describe("createItem / claim", () => {
  it("yeni öğe beklemede, anahtar ve zaman damgası korunur", () => {
    const a = item({ now: 5_000, key: "k-1" });
    expect(a).toMatchObject({
      idempotencyKey: "k-1",
      status: "pending",
      attempts: 0,
      clientTimestamp: new Date(5_000).toISOString(),
      failure: null,
      result: null,
    });
  });

  it("sırayı korur: seçim ekleme sırasındadır ve sınır uygulanır", () => {
    const a = item({ now: 1_000 });
    const b = item({ now: 1_000 });
    const c = item({ now: 1_001 });
    expect(selectDue([c, b, a], 2_000, 50).map((i) => i.idempotencyKey)).toEqual(
      [a, b, c].map((i) => i.idempotencyKey),
    );
    expect(selectDue([a, b, c], 2_000, 2)).toHaveLength(2);
  });

  it("gönderilirken durum sending olur, deneme sayısı artar, anahtar değişmez", () => {
    const a = item();
    const [sent] = claim([a], 2_000);
    expect(sent).toMatchObject({ status: "sending", attempts: 1, idempotencyKey: a.idempotencyKey });
  });

  it("zamanı gelmemiş, gönderilmekte olan ve bitmiş öğeler seçilmez", () => {
    const due = item();
    const later = { ...item(), nextAttemptAt: 9_000 };
    const sending = { ...item(), status: "sending" as const };
    const failed = { ...item(), status: "failed" as const };
    expect(selectDue([due, later, sending, failed], 2_000, 50)).toEqual([due]);
  });
});

describe("applyOutcome: ağ / sunucu hatası", () => {
  it.each<[string, BatchOutcome]>([
    ["ağ hatası", { kind: "network" }],
    ["5xx", { kind: "retry", status: 503 }],
  ])("%s: öğe beklemede kalır, AYNI anahtarla, geri çekilmeyle", (_name, outcome) => {
    const a = item();
    const sent = claimed([a]);
    const { items, pauseForAuth, events } = applyOutcome(sent, outcome, { now: 2_000, random: 0.5 });
    const next = items[0] as QueueItem;
    expect(pauseForAuth).toBe(false);
    expect(next.status).toBe("pending");
    expect(next.idempotencyKey).toBe(a.idempotencyKey);
    expect(next.nextAttemptAt).toBe(2_000 + backoffMs(1, 0.5));
    expect(next.lastError).toBeTruthy();
    expect(events[0]?.type).toBe("deferred");
  });

  it("kaybolan yanıttan sonra yeniden gönderim aynı anahtarı taşır (mükerrer check-in olamaz)", () => {
    const a = item();
    let items = claimed([a]);
    items = applyOutcome(items, { kind: "network" }, { now: 2_000, random: 0 }).items;
    const retry = claimed(items, 2_000 + 60_000);
    expect(retry).toHaveLength(1);
    expect(retry[0]?.idempotencyKey).toBe(a.idempotencyKey);
    expect(retry[0]?.clientTimestamp).toBe(a.clientTimestamp);
    expect(retry[0]?.attempts).toBe(2);
  });

  it("geri çekilme büyür ve sınırlıdır", () => {
    expect(backoffMs(1, 0.5)).toBeLessThan(backoffMs(2, 0.5));
    expect(backoffMs(2, 0.5)).toBeLessThan(backoffMs(3, 0.5));
    expect(backoffMs(50, 1)).toBeLessThanOrEqual(75_000);
    expect(backoffMs(50, 0)).toBeGreaterThan(0);
  });

  it("zamanı gelene kadar tekrar seçilmez", () => {
    const items = applyOutcome(claimed([item()]), { kind: "network" }, { now: 2_000, random: 0.5 }).items;
    expect(selectDue(items, 2_001, 50)).toHaveLength(0);
    expect(selectDue(items, 2_000 + 120_000, 50)).toHaveLength(1);
  });
});

describe("applyOutcome: sonuçlar", () => {
  it("başarı ve already_checked_in öğeyi tamamlar", () => {
    const a = item();
    const b = item();
    const sent = claimed([a, b]);
    const { items, events } = applyOutcome(
      sent,
      {
        kind: "results",
        results: [
          { idempotencyKey: a.idempotencyKey, result: { ok: true, data: success("r1", "checked_in") } },
          { idempotencyKey: b.idempotencyKey, result: { ok: true, data: success("r2", "already_checked_in") } },
        ],
      },
      { now: 2_000, random: 0 },
    );
    expect(items.map((i) => i.status)).toEqual(["done", "done"]);
    expect(items[1]?.result?.outcome).toBe("already_checked_in");
    expect(events.map((e) => e.type)).toEqual(["done", "done"]);
  });

  it.each(["conflict", "not_found", "invalid"] as const)(
    "%s kalıcı hata: durur, yeniden denenmez, sebep saklanır",
    (code) => {
      const a = item();
      const { items, events } = applyOutcome(
        claimed([a]),
        {
          kind: "results",
          results: [{ idempotencyKey: a.idempotencyKey, result: { ok: false, code, message: "Rezervasyon iptal" } }],
        },
        { now: 2_000, random: 0 },
      );
      const failed = items[0] as QueueItem;
      expect(failed.status).toBe("failed");
      expect(failed.failure).toEqual({ kind: "business", code, message: "Rezervasyon iptal" });
      expect(events[0]?.type).toBe("failed");
      expect(selectDue(items, 10_000_000, 50)).toHaveLength(0);
      expect(retryFailed(failed, 3_000)).toBe(failed); // saklanan iş kuralı sonucu tekrarlanmaz
    },
  );

  it("sunucu içi hata (code=error) ya da eksik sonuç yeniden denenir, kaybolmaz", () => {
    const a = item();
    const b = item();
    const { items } = applyOutcome(
      claimed([a, b]),
      {
        kind: "results",
        results: [{ idempotencyKey: a.idempotencyKey, result: { ok: false, code: "error", message: "x" } }],
      },
      { now: 2_000, random: 0 },
    );
    expect(items.map((i) => i.status)).toEqual(["pending", "pending"]);
  });

  it("toplu sonuçta bir öğenin kalıcı hatası diğerlerini etkilemez", () => {
    const a = item();
    const b = item();
    const { items } = applyOutcome(
      claimed([a, b]),
      {
        kind: "results",
        results: [
          { idempotencyKey: a.idempotencyKey, result: { ok: false, code: "conflict", message: "iptal" } },
          { idempotencyKey: b.idempotencyKey, result: { ok: true, data: success() } },
        ],
      },
      { now: 2_000, random: 0 },
    );
    expect(items.map((i) => i.status)).toEqual(["failed", "done"]);
  });
});

describe("applyOutcome: 401 ve reddedilen istek", () => {
  it("401: kuyruk durur, öğe beklemede ve deneme sayılmaz", () => {
    const a = item();
    const { items, pauseForAuth } = applyOutcome(claimed([a]), { kind: "unauthenticated" }, { now: 2_000, random: 0 });
    expect(pauseForAuth).toBe(true);
    expect(items[0]).toMatchObject({ status: "pending", attempts: 0, idempotencyKey: a.idempotencyKey });
  });

  it("öğe düzeyinde unauthenticated da kuyruğu durdurur", () => {
    const a = item();
    const { pauseForAuth, items } = applyOutcome(
      claimed([a]),
      {
        kind: "results",
        results: [{ idempotencyKey: a.idempotencyKey, result: { ok: false, code: "unauthenticated", message: "x" } }],
      },
      { now: 2_000, random: 0 },
    );
    expect(pauseForAuth).toBe(true);
    expect(items[0]?.status).toBe("pending");
  });

  it("400/403/415: öğe sessizce silinmez, istek düzeyi hata olarak durur ve operatör yeniden deneyebilir", () => {
    const a = item();
    const { items } = applyOutcome(
      claimed([a]),
      { kind: "rejected", status: 403, message: "Yetki yok" },
      { now: 2_000, random: 0 },
    );
    const failed = items[0] as QueueItem;
    expect(failed).toMatchObject({ status: "failed", failure: { kind: "request", status: 403 } });
    const again = retryFailed(failed, 5_000);
    expect(again).toMatchObject({
      status: "pending",
      failure: null,
      idempotencyKey: a.idempotencyKey,
      nextAttemptAt: 5_000,
    });
  });
});

describe("recoverInterrupted / summarize", () => {
  it("yarıda kalmış sending öğeleri beklemeye döner, anahtar aynı", () => {
    const a = item();
    const sent = claim([a], 2_000);
    const [back] = recoverInterrupted([...sent, item()]);
    expect(back).toMatchObject({ status: "pending", idempotencyKey: a.idempotencyKey });
  });

  it("özet sayıları", () => {
    const pending = item();
    const sending = { ...item(), status: "sending" as const };
    const failed = { ...item(), status: "failed" as const };
    expect(summarize([pending, sending, failed])).toEqual({ pending: 2, failed: 1 });
  });
});

describe("ownedBy / heldAside", () => {
  it("öğeler kullanıcıya göre ayrılır; sahibi bilinmeyenler ve tamamlananlar bekletilen sayılmaz/sayılır", () => {
    const mine = item();
    const theirs = item({ ownerId: OTHER_USER_ID });
    const unknown = { ...item(), ownerId: null };
    const doneTheirs = { ...item({ ownerId: OTHER_USER_ID }), status: "done" as const };
    const all = [mine, theirs, unknown, doneTheirs];
    expect(ownedBy(all, USER_ID)).toEqual([mine]);
    expect(heldAside(all, USER_ID).map((i) => i.idempotencyKey)).toEqual([theirs.idempotencyKey, unknown.idempotencyKey]);
    expect(heldAside(all, null).map((i) => i.idempotencyKey)).toEqual(all.slice(0, 3).map((i) => i.idempotencyKey));
  });
});
