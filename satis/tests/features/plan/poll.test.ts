import { describe, expect, it } from "vitest";
import { applyAvailability, nextPollDelay } from "@/features/plan/poll";

describe("poll", () => {
  it("sorgulama aralığı 4–6 sn arasındadır", () => {
    expect(nextPollDelay(() => 0)).toBe(4000);
    expect(nextPollDelay(() => 0.5)).toBe(5000);
    expect(nextPollDelay(() => 0.999)).toBeLessThan(6000);
  });
  it("eski zaman damgalı yanıt güncel durumu geri almaz", () => {
    const cur = { at: "2026-12-01T10:00:05.000Z", tables: [{ id: "t", free: 2 }] };
    const old = { at: "2026-12-01T10:00:01.000Z", tables: [{ id: "t", free: 5 }] };
    expect(applyAvailability(cur, old)).toBe(cur);
    expect(applyAvailability(old, cur)).toBe(cur);
  });
});
