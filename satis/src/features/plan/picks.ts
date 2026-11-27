import type { PlanModel, PlanTableModel } from "./model";

export const MAX_ORDER_TABLES = 5;
export const MAX_PARTY_SIZE = 12;

export type TablePick = { tableId: string; whole: false; seatNos: number[] } | { tableId: string; whole: true };
export type PickState = { partySize: number; picks: TablePick[]; activeTableId: string | null };
export type PickRules = { maxSeatsPerOrder: number; blockSingleLeftover: boolean };
export type PickAction =
  | { type: "focus"; tableId: string | null }
  | { type: "toggleSeat"; tableId: string; seatNo: number }
  | { type: "toggleWhole"; tableId: string }
  | { type: "removeTable"; tableId: string }
  | { type: "setPartySize"; partySize: number }
  | { type: "clear" };
export type PickStep = { state: PickState; notice: string | null };
export type HoldItem = { tableId: string; quantity: number; seatNos?: number[] };
export type Readiness = { ready: true; items: HoldItem[] } | { ready: false; reason: string | null };

export const PARTY_FULL_NOTICE = "Kişi sayınız doldu. Başka sandalye için önce seçtiklerinizden birini bırakın.";
export const TABLE_LIMIT_NOTICE = "Bir siparişte en çok 5 masadan seçim yapılabilir.";
export const orderLimitNotice = (max: number) => `Tek siparişte en çok ${max} bilet alınabilir.`;
export const PARTY_SHRUNK_NOTICE = "Kişi sayısı azaldı; seçiminiz temizlendi.";
export const seatTakenNotice = (kindLabel: string, seatNos: readonly number[]) =>
  `${kindLabel}: ${seatNos.join(", ")} numaralı sandalye az önce alındı ve seçiminizden çıkarıldı.`;
export const tableGoneNotice = (kindLabel: string) => `${kindLabel} az önce alındı ve seçiminizden çıkarıldı.`;
export const singleLeftReason = (kindLabel: string) =>
  `${kindLabel}: masada tek boş sandalye bırakılamaz. Bir sandalye daha seçin ya da birini bırakın.`;
export const missingReason = (n: number) => `${n} sandalye daha seçin.`;
export const OVER_PARTY_REASON = "Seçiminiz kişi sayısını aşıyor. Sandalye bırakın ya da kişi sayısını artırın.";

function kindLabel(table: Pick<PlanTableModel, "isLoca" | "label">): string {
  return `${table.isLoca ? "Loca" : "Masa"} ${table.label}`;
}

export function partyLimit(rules: PickRules): number {
  return Math.min(MAX_PARTY_SIZE, rules.maxSeatsPerOrder);
}

export function initialPicks(partySize: number): PickState {
  return { partySize: Math.max(1, partySize), picks: [], activeTableId: null };
}

export function pickedCount(state: PickState, model: PlanModel): number {
  const byId = new Map(model.tables.map((t) => [t.id, t]));
  let total = 0;
  for (const pick of state.picks) {
    if (pick.whole) {
      total += byId.get(pick.tableId)?.seats ?? 0;
    } else {
      total += pick.seatNos.length;
    }
  }
  return total;
}

export function seatsPicked(state: PickState, tableId: string): number[] {
  const pick = state.picks.find((p) => p.tableId === tableId);
  return pick && !pick.whole ? pick.seatNos : [];
}

export function applyPick(state: PickState, action: PickAction, model: PlanModel, rules: PickRules): PickStep {
  switch (action.type) {
    case "focus":
      return { state: { ...state, activeTableId: action.tableId }, notice: null };

    case "clear":
      return { state: { ...state, picks: [] }, notice: null };

    case "removeTable":
      return {
        state: { ...state, picks: state.picks.filter((p) => p.tableId !== action.tableId) },
        notice: null,
      };

    case "setPartySize": {
      const limit = partyLimit(rules);
      const nextSize = Math.max(1, Math.min(limit, Math.trunc(action.partySize)));
      if (pickedCount(state, model) > nextSize) {
        return {
          state: { partySize: nextSize, picks: [], activeTableId: state.activeTableId },
          notice: PARTY_SHRUNK_NOTICE,
        };
      }
      return { state: { ...state, partySize: nextSize }, notice: null };
    }

    case "toggleSeat": {
      const table = model.tables.find((t) => t.id === action.tableId);
      if (!table || table.status !== "available" || table.wholeOnly || !table.seatNos.includes(action.seatNo)) {
        return { state, notice: null };
      }

      const existingIdx = state.picks.findIndex((p) => p.tableId === action.tableId);
      const existing = existingIdx >= 0 ? state.picks[existingIdx] : undefined;
      if (existing && existing.whole) return { state, notice: null };

      if (existing && !existing.whole && existing.seatNos.includes(action.seatNo)) {
        const nextSeats = existing.seatNos.filter((n) => n !== action.seatNo);
        const nextPicks =
          nextSeats.length === 0
            ? state.picks.filter((p) => p.tableId !== action.tableId)
            : state.picks.map((p, idx) => (idx === existingIdx ? { ...existing, seatNos: nextSeats } : p));
        return { state: { ...state, picks: nextPicks, activeTableId: action.tableId }, notice: null };
      }

      if (!table.freeSeats.includes(action.seatNo)) return { state, notice: null };
      if (pickedCount(state, model) >= state.partySize) return { state, notice: PARTY_FULL_NOTICE };
      if (!existing && state.picks.length >= MAX_ORDER_TABLES) return { state, notice: TABLE_LIMIT_NOTICE };

      const nextSeats = existing && !existing.whole ? [...existing.seatNos, action.seatNo].sort((a, b) => a - b) : [action.seatNo];
      const nextPicks = existing
        ? state.picks.map((p, idx) => (idx === existingIdx ? { tableId: action.tableId, whole: false as const, seatNos: nextSeats } : p))
        : [...state.picks, { tableId: action.tableId, whole: false as const, seatNos: nextSeats }];

      return { state: { ...state, picks: nextPicks, activeTableId: action.tableId }, notice: null };
    }

    case "toggleWhole": {
      const table = model.tables.find((t) => t.id === action.tableId);
      if (!table || table.status !== "available" || !table.wholeOnly) return { state, notice: null };

      const existing = state.picks.find((p) => p.tableId === action.tableId);
      if (existing) {
        return {
          state: {
            ...state,
            picks: state.picks.filter((p) => p.tableId !== action.tableId),
            activeTableId: action.tableId,
          },
          notice: null,
        };
      }

      const seats = table.seats ?? 0;
      if (seats <= 0 || table.freeSeats.length < seats) return { state, notice: null };
      if (state.picks.length >= MAX_ORDER_TABLES) return { state, notice: TABLE_LIMIT_NOTICE };
      if (pickedCount(state, model) + seats > rules.maxSeatsPerOrder) {
        return { state, notice: orderLimitNotice(rules.maxSeatsPerOrder) };
      }

      return {
        state: {
          ...state,
          picks: [...state.picks, { tableId: action.tableId, whole: true }],
          activeTableId: action.tableId,
        },
        notice: null,
      };
    }
  }
}

export function reconcilePicks(state: PickState, model: PlanModel): PickStep {
  if (state.picks.length === 0) return { state, notice: null };

  const byId = new Map(model.tables.map((t) => [t.id, t]));
  const nextPicks: TablePick[] = [];
  const notices: string[] = [];
  let changed = false;

  for (const pick of state.picks) {
    const table = byId.get(pick.tableId);
    if (!table || table.status === "not_sellable") {
      changed = true;
      notices.push(tableGoneNotice(table ? kindLabel(table) : `Masa ${pick.tableId.toUpperCase()}`));
      continue;
    }

    if (pick.whole) {
      const seats = table.seats ?? 0;
      if (!table.wholeOnly || seats <= 0 || table.freeSeats.length < seats) {
        changed = true;
        notices.push(tableGoneNotice(kindLabel(table)));
        continue;
      }
      nextPicks.push(pick);
      continue;
    }

    if (table.wholeOnly) {
      changed = true;
      notices.push(tableGoneNotice(kindLabel(table)));
      continue;
    }

    const freeSet = new Set(table.freeSeats);
    const kept = pick.seatNos.filter((n) => freeSet.has(n));
    const dropped = pick.seatNos.filter((n) => !freeSet.has(n));

    if (dropped.length > 0) {
      changed = true;
      notices.push(seatTakenNotice(kindLabel(table), dropped));
    }
    if (kept.length > 0) {
      nextPicks.push(dropped.length === 0 ? pick : { tableId: pick.tableId, whole: false, seatNos: kept });
    }
  }

  if (!changed) return { state, notice: null };
  return {
    state: { ...state, picks: nextPicks },
    notice: notices.length > 0 ? notices.join(" ") : null,
  };
}

export function readiness(state: PickState, model: PlanModel, rules: PickRules): Readiness {
  const total = pickedCount(state, model);
  if (total === 0) return { ready: false, reason: null };

  const byId = new Map(model.tables.map((t) => [t.id, t]));

  if (rules.blockSingleLeftover) {
    for (const pick of state.picks) {
      if (pick.whole) continue;
      const table = byId.get(pick.tableId);
      if (table && table.freeSeats.length - pick.seatNos.length === 1) {
        return { ready: false, reason: singleLeftReason(kindLabel(table)) };
      }
    }
  }

  const hasSeatPick = state.picks.some((p) => !p.whole);
  if (hasSeatPick) {
    if (total < state.partySize) return { ready: false, reason: missingReason(state.partySize - total) };
    if (total > state.partySize) return { ready: false, reason: OVER_PARTY_REASON };
  }

  const items: HoldItem[] = state.picks.map((pick) => {
    if (pick.whole) {
      const table = byId.get(pick.tableId);
      return { tableId: pick.tableId, quantity: table?.seats ?? 0 };
    }
    return { tableId: pick.tableId, quantity: pick.seatNos.length, seatNos: pick.seatNos };
  });

  return { ready: true, items };
}

export function holdSignature(items: readonly HoldItem[]): string {
  return [...items]
    .sort((a, b) => a.tableId.localeCompare(b.tableId))
    .map((item) => {
      const seats = item.seatNos ? [...item.seatNos].sort((a, b) => a - b).join(",") : "";
      return `${item.tableId}:${item.quantity}:${seats}`;
    })
    .join("|");
}
