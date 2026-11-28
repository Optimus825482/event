import type { ColorName } from "@/lib/theme";
import type { PlanTableModel } from "./model";

export type TableVisual = "standard" | "premium" | "vip" | "sold_out" | "not_sellable" | "picked" | "active";

/** Seçim ve durum, kategori renginin önüne geçer. */
export function tableVisual(
  table: Pick<PlanTableModel, "status" | "category">,
  mark: "none" | "picked" | "active",
): TableVisual {
  if (table.status === "not_sellable") return "not_sellable";
  if (table.status === "sold_out") return "sold_out";
  if (mark === "active") return "active";
  if (mark === "picked") return "picked";
  return table.category ?? "standard";
}

export const TABLE_STYLES: Record<TableVisual, { fill: ColorName; stroke: ColorName; text: ColorName }> = {
  standard: { fill: "surfaceRaised", stroke: "ivory", text: "ivory" },
  premium: { fill: "surfaceRaised", stroke: "gold", text: "gold" },
  vip: { fill: "gold", stroke: "goldBright", text: "onGold" },
  sold_out: { fill: "disabledBg", stroke: "line", text: "disabledText" },
  not_sellable: { fill: "surface", stroke: "line", text: "muted" },
  picked: { fill: "selection", stroke: "ivory", text: "onGold" },
  active: { fill: "selection", stroke: "ivory", text: "onGold" },
};
