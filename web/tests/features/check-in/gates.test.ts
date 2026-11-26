import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CHECK_IN_GATE_COUNT, CHECK_IN_GATES, GATE_STORAGE_KEY, gateLabel, parseGate } from "@/features/check-in/gates";
import { checkInSuccessSchema } from "@/features/check-in/result-schema";
import { checkInInput, walkInInput } from "@/features/check-in/schemas";

describe("kapı sözlüğü", () => {
  it("kapı sayısı, listesi ve etiketi", () => {
    expect(CHECK_IN_GATE_COUNT).toBe(3);
    expect(CHECK_IN_GATES).toEqual([1, 2, 3]);
    expect(gateLabel(2)).toBe("Kapı 2");
    expect(GATE_STORAGE_KEY).toBe("eventflow.check-in.gate");
  });

  it.each([
    ["2", 2],
    [3, 3],
    ["4", null],
    ["0", null],
    ["abc", null],
    [null, null],
    [1.5, null],
  ] as const)("parseGate(%s) = %s", (raw, expected) => {
    expect(parseGate(raw)).toBe(expected);
  });
});

describe("giriş şemaları", () => {
  it.each([0, 10, 1.5])("checkInInput kapı %s değerini reddeder", (gate) => {
    const r = checkInInput.safeParse({ eventId: randomUUID(), idempotencyKey: randomUUID(), token: "a.b", gate });
    expect(r.success).toBe(false);
  });

  it("walkInInput kapı sınırını uygular", () => {
    const base = { eventId: randomUUID(), tableId: randomUUID(), guestName: "A", guestCount: 1 };
    expect(walkInInput.safeParse({ ...base, gate: 9 }).success).toBe(true);
    expect(walkInInput.safeParse({ ...base, gate: 10 }).success).toBe(false);
  });

  it("dört hedeften tam olarak biri verilmelidir", () => {
    const base = { eventId: randomUUID(), idempotencyKey: randomUUID() };
    expect(checkInInput.safeParse({ ...base, ticketId: randomUUID() }).success).toBe(true);
    expect(checkInInput.safeParse({ ...base, token: "a.b", ticketId: randomUUID() }).success).toBe(false);
    expect(checkInInput.safeParse(base).success).toBe(false);
  });

  it("eski yanıt (kind/ticketId/pnr/gate yok) rezervasyon girişi olarak okunur", () => {
    const old = {
      outcome: "checked_in",
      reservationId: "r1",
      eventId: "e1",
      guestName: null,
      guestCount: 2,
      tableId: "t1",
      tableLabel: "A1",
      checkedInAt: "2026-11-26T18:00:00.000Z",
      checkedInBy: null,
    };
    expect(checkInSuccessSchema.parse(old)).toEqual({ ...old, kind: "reservation", ticketId: null, pnr: null, gate: null });
  });
});
