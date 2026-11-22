import type { PlanTable } from "@/features/venue/plan-types";

/** `?masa=` değeri masa kimliği ya da etiketidir (etiket büyük/küçük harf duyarsız); bulunamazsa `null`. */
export function findPlanTable(tables: readonly PlanTable[], key: string | undefined): PlanTable | null {
  if (!key) return null;
  const byId = tables.find((t) => t.id === key);
  if (byId) return byId;
  const wanted = key.trim().toLocaleLowerCase("tr-TR");
  if (!wanted) return null;
  return tables.find((t) => t.label.toLocaleLowerCase("tr-TR") === wanted) ?? null;
}
