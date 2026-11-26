import { describe, expect, it } from "vitest";
import { batchMessage, batchTone, tallyBatch } from "@/features/check-in/components/batch-feedback";
import type { SettledEvent } from "@/features/check-in/offline/queue-core";
import { success, ticketItem } from "./helpers";

function done(key: string, outcome: "checked_in" | "already_checked_in"): SettledEvent {
  return { type: "done", item: { ...ticketItem({ ticketId: key, key }), status: "done", result: success("r", outcome) } };
}

describe("tallyBatch", () => {
  it("her anahtarın son olayını sayar", () => {
    const failed: SettledEvent = {
      type: "failed",
      item: { ...ticketItem({ ticketId: "c", key: "c" }), status: "failed" },
    };
    const deferredThenDone: SettledEvent[] = [
      { type: "deferred", item: ticketItem({ ticketId: "e", key: "e" }), reason: "network" },
      done("e", "checked_in"),
    ];
    expect(tallyBatch(["a", "b", "c", "d"], [done("a", "checked_in"), done("b", "already_checked_in"), failed])).toEqual({
      checkedIn: 1,
      already: 1,
      failed: 1,
      queued: 1,
    });
    expect(tallyBatch(["e"], deferredThenDone)).toEqual({ checkedIn: 1, already: 0, failed: 0, queued: 0 });
  });

  it("ertelenen öğe kuyrukta sayılır; başka toplu işin olayı karışmaz", () => {
    const deferred: SettledEvent = { type: "deferred", item: ticketItem({ ticketId: "a", key: "a" }), reason: "network" };
    expect(tallyBatch(["a"], [deferred, done("zzz", "checked_in")])).toEqual({ checkedIn: 0, already: 0, failed: 0, queued: 1 });
  });
});

describe("batchMessage", () => {
  it("sıfır olmayan parçaları birleştirir", () => {
    expect(batchMessage({ checkedIn: 3, already: 0, failed: 0, queued: 0 })).toBe("3 bilet içeri alındı");
    expect(batchMessage({ checkedIn: 2, already: 1, failed: 1, queued: 0 })).toBe(
      "2 bilet içeri alındı · 1 zaten giriş yapmıştı · 1 reddedildi",
    );
    expect(batchMessage({ checkedIn: 0, already: 0, failed: 0, queued: 3 })).toBe("3 kuyruğa alındı");
  });
});

describe("batchTone", () => {
  it("hepsi tamam yeşil, ret varsa amber, aksi mavi", () => {
    expect(batchTone({ checkedIn: 3, already: 0, failed: 0, queued: 0 })).toBe("ok");
    expect(batchTone({ checkedIn: 2, already: 0, failed: 1, queued: 0 })).toBe("warn");
    expect(batchTone({ checkedIn: 0, already: 0, failed: 0, queued: 3 })).toBe("info");
    expect(batchTone({ checkedIn: 2, already: 1, failed: 0, queued: 0 })).toBe("info");
  });
});

describe("tallyBatch: toplayıcı", () => {
  it("toplayıcıya yazımdan önce düşen yabancı olaylar sayıma girmez", () => {
    expect(tallyBatch(["a"], [done("x", "checked_in"), done("a", "checked_in")])).toEqual({
      checkedIn: 1,
      already: 0,
      failed: 0,
      queued: 0,
    });
  });
});
