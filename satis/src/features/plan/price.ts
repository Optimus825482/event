import type { EventDetail } from "@/lib/core/contract";
import { multiplyMoney } from "@/lib/format";
import type { PlanModel } from "./model";
import type { PickState } from "./picks";

const HUNDRED = BigInt(100);
const ZERO = BigInt(0);

function toMinor(amount: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!match) throw new Error(`Geçersiz tutar: ${amount}`);
  const minor = BigInt(match[2] as string) * HUNDRED + BigInt((match[3] ?? "").padEnd(2, "0") || "0");
  return match[1] === "-" ? -minor : minor;
}

function fromMinor(minor: bigint): string {
  const negative = minor < ZERO;
  const digits = (negative ? -minor : minor).toString().padStart(3, "0");
  return `${negative ? "-" : ""}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

export function sumMoney(amounts: readonly string[]): string {
  let total = ZERO;
  for (const amount of amounts) {
    total += toMinor(amount);
  }
  return fromMinor(total);
}

export function picksTotal(state: PickState, model: PlanModel, prices: EventDetail["prices"]): string | null {
  if (state.picks.length === 0) return "0.00";
  const byId = new Map(model.tables.map((t) => [t.id, t]));
  const priceByCategory = new Map(prices.map((p) => [p.category, p.price]));
  const amounts: string[] = [];

  for (const pick of state.picks) {
    const table = byId.get(pick.tableId);
    if (!table || !table.category) return null;
    const unitPrice = priceByCategory.get(table.category);
    if (!unitPrice) return null;
    const qty = pick.whole ? (table.seats ?? 0) : pick.seatNos.length;
    amounts.push(multiplyMoney(unitPrice, qty));
  }

  return sumMoney(amounts);
}
