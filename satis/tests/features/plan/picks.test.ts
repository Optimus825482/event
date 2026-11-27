import { describe, expect, it } from "vitest";
import { buildPlanModel } from "@/features/plan/model";
import {
  applyPick,
  holdSignature,
  initialPicks,
  orderLimitNotice,
  OVER_PARTY_REASON,
  PARTY_FULL_NOTICE,
  PARTY_SHRUNK_NOTICE,
  partyLimit,
  pickedCount,
  readiness,
  reconcilePicks,
  seatTakenNotice,
  seatsPicked,
  singleLeftReason,
  TABLE_LIMIT_NOTICE,
  tableGoneNotice,
  missingReason,
  type PickAction,
  type PickRules,
  type PickState,
  type PickStep,
} from "@/features/plan/picks";
import type { EventDetail } from "@/lib/core/contract";

const seq = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

const plan: EventDetail["plan"] = {
  canvas: { width: 1200, height: 800 },
  tables: [
    ...["a1", "a2", "a3", "a4", "a5", "a6"].map((id, idx) => ({
      id,
      label: id.toUpperCase(),
      x: 100 + idx * 80,
      y: 100,
      rotation: 0,
      shape: "round" as const,
      isLoca: false,
      sellable: true,
      category: "standard" as const,
      capacity: 8,
      seats: 8,
      seatNos: seq(8),
      wholeOnly: false,
    })),
    {
      id: "g1",
      label: "G1",
      x: 100,
      y: 250,
      rotation: 0,
      shape: "round",
      isLoca: false,
      sellable: true,
      category: "standard",
      capacity: 8,
      seats: 6,
      seatNos: [1, 2, 3, 5, 6, 8],
      wholeOnly: false,
    },
    {
      id: "l1",
      label: "L1",
      x: 200,
      y: 250,
      rotation: 0,
      shape: "rectangle",
      isLoca: true,
      sellable: true,
      category: "vip",
      capacity: 6,
      seats: 6,
      seatNos: seq(6),
      wholeOnly: true,
    },
    {
      id: "c1",
      label: "C1",
      x: 300,
      y: 250,
      rotation: 0,
      shape: "square",
      isLoca: false,
      sellable: false,
      category: null,
      capacity: 8,
      seats: null,
      seatNos: [],
      wholeOnly: false,
    },
  ],
  decor: [],
  lines: [],
};

const prices: EventDetail["prices"] = [
  { category: "standard", label: "Standart", price: "1500.00" },
  { category: "vip", label: "VIP", price: "4000.00" },
];

const defaultFree: Record<string, number[]> = {
  a1: seq(8),
  a2: seq(8),
  a3: seq(8),
  a4: seq(8),
  a5: seq(8),
  a6: seq(8),
  g1: [1, 2, 3, 5, 6, 8],
  l1: seq(6),
};

function modelWith(overrides: Record<string, number[]> = {}, saleMode: "seat" | "table" = "seat") {
  const merged = { ...defaultFree, ...overrides };
  const effectivePlan: EventDetail["plan"] =
    saleMode === "table"
      ? {
          ...plan,
          tables: plan.tables.map((t) => (t.sellable ? { ...t, wholeOnly: true } : t)),
        }
      : plan;
  return buildPlanModel(
    effectivePlan,
    prices,
    {
      at: "2026-12-01T10:00:00Z",
      tables: Object.entries(merged).map(([id, freeSeats]) => ({
        id,
        free: freeSeats.length,
        freeSeats,
      })),
    },
    saleMode,
  );
}

const model = modelWith();
const tableModeModel = modelWith({}, "table");
const rules: PickRules = { maxSeatsPerOrder: 12, blockSingleLeftover: true };
const seat = (tableId: string, seatNo: number): PickAction => ({ type: "toggleSeat", tableId, seatNo });
const run = (s: PickState, ...actions: PickAction[]) =>
  actions.reduce((step, x) => applyPick(step.state, x, model, rules), { state: s, notice: null } as PickStep);

describe("picks", () => {
  it("partyLimit 12 ve maxSeatsPerOrder küçüğünü döner", () => {
    expect(partyLimit({ maxSeatsPerOrder: 20, blockSingleLeftover: true })).toBe(12);
    expect(partyLimit({ maxSeatsPerOrder: 6, blockSingleLeftover: true })).toBe(6);
  });

  it("boş sandalye seçilir, yeniden dokununca bırakılır; numaralar artan tutulur", () => {
    const s = run(initialPicks(4), seat("a1", 7), seat("a1", 4)).state;
    expect(s.picks).toEqual([{ tableId: "a1", whole: false, seatNos: [4, 7] }]);
    expect(s.activeTableId).toBe("a1");
    expect(seatsPicked(s, "a1")).toEqual([4, 7]);
    expect(run(s, seat("a1", 4), seat("a1", 7)).state.picks).toEqual([]);
  });

  it("dolu, yuvasız ya da masada olmayan sandalye seçilemez (aynı durum döner)", () => {
    const s = initialPicks(4);
    expect(applyPick(s, seat("a2", 1), modelWith({ a2: [3, 4] }), rules).state).toBe(s);
    expect(applyPick(s, seat("g1", 4), model, rules).state).toBe(s);
    expect(applyPick(s, seat("c1", 1), model, rules).state).toBe(s);
  });

  it("kişi sayısı dolunca yeni seçim en eskiyi bırakmaz; uyarı döner", () => {
    const full = run(initialPicks(2), seat("a1", 1), seat("a1", 2));
    const next = applyPick(full.state, seat("a1", 3), model, rules);
    expect(next.state).toBe(full.state);
    expect(next.notice).toBe(PARTY_FULL_NOTICE);
  });

  it("seçim birden çok masaya yayılır; altıncı masa reddedilir", () => {
    const five = run(initialPicks(6), seat("a1", 1), seat("a2", 1), seat("a3", 1), seat("a4", 1), seat("a5", 1));
    expect(five.state.picks).toHaveLength(5);
    const sixth = applyPick(five.state, seat("a6", 1), model, rules);
    expect(sixth.state).toBe(five.state);
    expect(sixth.notice).toBe(TABLE_LIMIT_NOTICE);
  });

  it("loca ve masa bazlı kipteki masa bütün seçilir; tek sandalye eylemi yok sayılır", () => {
    const s = run(initialPicks(2), { type: "toggleWhole", tableId: "l1" }).state;
    expect(s.picks).toEqual([{ tableId: "l1", whole: true }]);
    expect(pickedCount(s, model)).toBe(6);
    expect(applyPick(s, seat("l1", 1), model, rules).state).toBe(s);
    expect(applyPick(initialPicks(2), { type: "toggleWhole", tableId: "a1" }, tableModeModel, rules).state.picks).toEqual([
      { tableId: "a1", whole: true },
    ]);
  });

  it("bütün masa sipariş sınırını aşıyorsa ya da kısmen doluysa seçilmez", () => {
    expect(
      applyPick(initialPicks(2), { type: "toggleWhole", tableId: "l1" }, model, { ...rules, maxSeatsPerOrder: 4 }).notice,
    ).toBe(orderLimitNotice(4));
    const s = initialPicks(2);
    expect(applyPick(s, { type: "toggleWhole", tableId: "l1" }, modelWith({ l1: [1, 2, 3] }), rules).state).toBe(s);
  });

  it("kişi sayısı sınırlanır; küçülünce sığmayan seçim temizlenir", () => {
    expect(applyPick(initialPicks(2), { type: "setPartySize", partySize: 99 }, model, rules).state.partySize).toBe(12);
    expect(applyPick(initialPicks(2), { type: "setPartySize", partySize: 0 }, model, rules).state.partySize).toBe(1);
    const three = run(initialPicks(3), seat("a1", 1), seat("a1", 2), seat("a1", 3)).state;
    expect(applyPick(three, { type: "setPartySize", partySize: 2 }, model, rules)).toEqual({
      state: { partySize: 2, picks: [], activeTableId: "a1" },
      notice: PARTY_SHRUNK_NOTICE,
    });
    expect(applyPick(three, { type: "setPartySize", partySize: 5 }, model, rules).state.picks).toEqual(three.picks);
  });

  describe("reconcilePicks", () => {
    it("değişiklik yoksa aynı nesne döner", () => {
      const s = run(initialPicks(2), seat("a1", 4)).state;
      expect(reconcilePicks(s, model)).toEqual({ state: s, notice: null });
      expect(reconcilePicks(s, model).state).toBe(s);
    });

    it("alınan sandalye seçimden düşer, kalanlar durur, uyarı sandalyeyi adlandırır", () => {
      const s = run(initialPicks(2), seat("a1", 4), seat("a1", 7)).state;
      const r = reconcilePicks(s, modelWith({ a1: [1, 2, 3, 5, 6, 7, 8] }));
      expect(r.state.picks).toEqual([{ tableId: "a1", whole: false, seatNos: [7] }]);
      expect(r.notice).toBe(seatTakenNotice("Masa A1", [4]));
    });

    it("free sayısı yamayla düşse bile ölçüt freeSeats'tir", () => {
      const s = run(initialPicks(2), seat("a1", 4), seat("a1", 7)).state;
      const patched = buildPlanModel(
        plan,
        prices,
        {
          at: "2026-12-01T10:00:00Z",
          tables: [{ id: "a1", free: 0, freeSeats: [4, 7] }],
        },
        "seat",
      );
      expect(reconcilePicks(s, patched).state).toBe(s);
    });

    it("bütün seçilen masa kısmen dolunca düşer", () => {
      const s = run(initialPicks(2), { type: "toggleWhole", tableId: "l1" }).state;
      const r = reconcilePicks(s, modelWith({ l1: [1, 2, 3, 4, 5] }));
      expect(r.state.picks).toEqual([]);
      expect(r.notice).toBe(tableGoneNotice("Loca L1"));
    });

    it("planda artık olmayan ya da satışa kapanan masa düşer", () => {
      const s = run(initialPicks(2), seat("a1", 1)).state;
      const withoutA1 = { ...model, tables: model.tables.filter((t) => t.id !== "a1") };
      const r = reconcilePicks(s, withoutA1);
      expect(r.state.picks).toEqual([]);
      expect(r.notice).toBe(tableGoneNotice("Masa A1"));
    });
  });

  describe("readiness", () => {
    it("boş seçim hazır değildir ve neden göstermez", () => {
      expect(readiness(initialPicks(2), model, rules)).toEqual({ ready: false, reason: null });
    });

    it("eksik sandalye sayısı nedende yazar", () => {
      expect(readiness(run(initialPicks(4), seat("a1", 1)).state, model, rules)).toEqual({
        ready: false,
        reason: missingReason(3),
      });
    });

    it("tam seçim kalemleri seçim sırasıyla ve seatNos ile üretir", () => {
      expect(
        readiness(run(initialPicks(4), seat("a1", 4), seat("a1", 7), seat("a2", 1), seat("a2", 2)).state, model, rules),
      ).toEqual({
        ready: true,
        items: [
          { tableId: "a1", quantity: 2, seatNos: [4, 7] },
          { tableId: "a2", quantity: 2, seatNos: [1, 2] },
        ],
      });
    });

    it("bütün kalem seatNos taşımaz ve kişi sayısına bağlı değildir", () => {
      expect(readiness(run(initialPicks(2), { type: "toggleWhole", tableId: "l1" }).state, model, rules)).toEqual({
        ready: true,
        items: [{ tableId: "l1", quantity: 6 }],
      });
    });

    it("masada tek boş sandalye bırakan seçim hazır değildir; kural kapalıysa hazırdır", () => {
      const s = run(initialPicks(2), seat("a2", 3), seat("a2", 4)).state;
      expect(readiness(s, modelWith({ a2: [3, 4, 5] }), rules)).toEqual({
        ready: false,
        reason: singleLeftReason("Masa A2"),
      });
      expect(readiness(s, modelWith({ a2: [3, 4, 5] }), { ...rules, blockSingleLeftover: false }).ready).toBe(true);
    });

    it("loca + sandalye toplamı kişi sayısını aşarsa hazır değildir", () => {
      const over = run(initialPicks(6), seat("a1", 1), { type: "toggleWhole", tableId: "l1" }).state;
      expect(readiness(over, model, rules)).toEqual({ ready: false, reason: OVER_PARTY_REASON });

      const exact = run(initialPicks(7), seat("a1", 1), { type: "toggleWhole", tableId: "l1" }).state;
      expect(readiness(exact, model, rules).ready).toBe(true);
    });
  });

  it("holdSignature kalem sırasından ve sandalye sırasından bağımsızdır", () => {
    const a = holdSignature([
      { tableId: "a2", quantity: 2, seatNos: [2, 1] },
      { tableId: "a1", quantity: 2, seatNos: [7, 4] },
    ]);
    const b = holdSignature([
      { tableId: "a1", quantity: 2, seatNos: [4, 7] },
      { tableId: "a2", quantity: 2, seatNos: [1, 2] },
    ]);
    expect(a).toBe(b);
  });
});
