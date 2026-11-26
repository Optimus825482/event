import type { Availability, EventDetail, PlanTablePublic } from "@/lib/core/contract";
import { parseDecor, parseLines, type PlanDecor, type PlanLine } from "./decor";

/** Masalar sabit boyutla çizilir (PlanTablePublic boyut taşımaz). */
export const TABLE_SIZE = 40;

export type SaleCategory = NonNullable<PlanTablePublic["category"]>;

export function tableDims(shape: PlanTablePublic["shape"], isLoca: boolean): { width: number; height: number } {
  if (isLoca) return { width: 48, height: 36 };
  if (shape === "rectangle") return { width: TABLE_SIZE, height: 24 };
  return { width: TABLE_SIZE, height: TABLE_SIZE };
}

export type TableStatus = "available" | "sold_out" | "not_sellable";

export type PlanTableModel = {
  id: string;
  label: string;
  x: number;
  y: number;
  rotation: number;
  shape: PlanTablePublic["shape"];
  isLoca: boolean;
  width: number;
  height: number;
  category: SaleCategory | null;
  categoryLabel: string | null;
  seats: number | null;
  free: number | null;
  wholeOnly: boolean;
  status: TableStatus;
  countLabel: string | null;
  ariaLabel: string;
};

export type PlanModel = {
  canvas: { width: number; height: number };
  tables: PlanTableModel[];
  decor: PlanDecor[];
  lines: PlanLine[];
};

export function buildPlanModel(plan: EventDetail["plan"], prices: EventDetail["prices"], availability: Availability): PlanModel {
  const freeById = new Map(availability.tables.map((row) => [row.id, row.free]));
  const labelByCategory = new Map(prices.map((p) => [p.category, p.label]));

  const tables = plan.tables.map((table): PlanTableModel => {
    const { width, height } = tableDims(table.shape, table.isLoca);
    const base = {
      id: table.id,
      label: table.label,
      x: table.x,
      y: table.y,
      rotation: table.rotation,
      shape: table.shape,
      isLoca: table.isLoca,
      width,
      height,
      wholeOnly: table.wholeOnly,
    };
    const kind = table.isLoca ? "Loca" : "Masa";

    if (!table.sellable) {
      return {
        ...base,
        category: null,
        categoryLabel: null,
        seats: table.seats,
        free: null,
        status: "not_sellable",
        countLabel: null,
        ariaLabel: `${kind} ${table.label}, satışta değil`,
      };
    }

    const seats = table.seats ?? 0;
    const free = freeById.get(table.id) ?? 0;
    const categoryLabel = table.category ? (labelByCategory.get(table.category) ?? table.category) : null;
    const head = [`${kind} ${table.label}`, categoryLabel].filter(Boolean).join(", ");
    const soldOut = free === 0 || (table.wholeOnly && free < seats);
    const countLabel = `${free}/${seats}`;
    const common = { ...base, category: table.category, categoryLabel, seats: table.seats, free, countLabel };
    if (soldOut) return { ...common, status: "sold_out", ariaLabel: `${head}, dolu` };
    return {
      ...common,
      status: "available",
      ariaLabel: table.wholeOnly ? `${head}, yalnızca bütün olarak ${seats} kişilik` : `${head}, boş sandalye ${countLabel}`,
    };
  });

  return { canvas: plan.canvas, tables, decor: parseDecor(plan.decor), lines: parseLines(plan.lines) };
}
