import type { Availability, EventDetail, PlanTablePublic, SaleMode } from "@/lib/core/contract";
import { parseDecor, parseLines, type PlanDecor, type PlanLine } from "./decor";

/** Masalar sabit boyutla çizilir (PlanTablePublic boyut taşımaz). */
export const TABLE_SIZE = 40;

export type SaleCategory = NonNullable<PlanTablePublic["category"]>;

export function tableDims(shape: PlanTablePublic["shape"], isLoca: boolean): { width: number; height: number } {
  // Loca kutusu prototipte tam boyut 4.67×3.2 m (hall.js:278); 15 px/m → 70×48 px.
  if (isLoca) return { width: 70, height: 48 };
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
  capacity: number;
  seats: number | null;
  seatNos: number[];
  free: number | null;
  freeSeats: number[];
  wholeOnly: boolean;
  status: TableStatus;
  countLabel: string | null;
  ariaLabel: string;
};

export type PlanModel = {
  canvas: { width: number; height: number };
  saleMode: SaleMode;
  tables: PlanTableModel[];
  decor: PlanDecor[];
  lines: PlanLine[];
};

const sortedNums = (nums: readonly number[]) => [...nums].sort((a, b) => a - b);

export function buildPlanModel(
  plan: EventDetail["plan"],
  prices: EventDetail["prices"],
  availability: Availability,
  saleMode: SaleMode,
): PlanModel {
  const availabilityById = new Map(availability.tables.map((row) => [row.id, row]));
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
      capacity: table.capacity,
      wholeOnly: table.wholeOnly,
    };
    const kind = table.isLoca ? "Loca" : "Masa";

    if (!table.sellable) {
      return {
        ...base,
        category: null,
        categoryLabel: null,
        seats: table.seats,
        seatNos: [],
        free: null,
        freeSeats: [],
        status: "not_sellable",
        countLabel: null,
        ariaLabel: `${kind} ${table.label}, satışta değil`,
      };
    }

    const seats = table.seats ?? 0;
    const row = availabilityById.get(table.id);
    const free = row?.free ?? 0;
    const freeSeats = sortedNums(row?.freeSeats ?? []);
    const seatNos = sortedNums(table.seatNos);
    const categoryLabel = table.category ? (labelByCategory.get(table.category) ?? table.category) : null;
    const head = [`${kind} ${table.label}`, categoryLabel].filter(Boolean).join(", ");
    const soldOut = free === 0 || (table.wholeOnly && free < seats);
    const countLabel = `${free}/${seats}`;
    const common = {
      ...base,
      category: table.category,
      categoryLabel,
      seats: table.seats,
      seatNos,
      free,
      freeSeats,
      countLabel,
    };
    if (soldOut) return { ...common, status: "sold_out", ariaLabel: `${head}, dolu` };
    return {
      ...common,
      status: "available",
      ariaLabel: table.wholeOnly ? `${head}, yalnızca bütün olarak ${seats} kişilik` : `${head}, boş sandalye ${countLabel}`,
    };
  });

  return { canvas: plan.canvas, saleMode, tables, decor: parseDecor(plan.decor), lines: parseLines(plan.lines) };
}
