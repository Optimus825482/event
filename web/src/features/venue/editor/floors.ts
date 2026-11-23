import type { DecorElement, DecorLine } from "../schemas";
import { decorFloor, decorItemKey } from "./collision";
import { lineFloor, lineKey } from "./lines";

/** Düzenleyicide üzerinde çalışılan kat; `null` = tüm katlar (hepsi düzenlenebilir). */
export type ActiveFloor = number | null;

type FloorSource = {
  tables: ReadonlyArray<{ key: string; floor: number }>;
  elements: ReadonlyArray<Pick<DecorElement, "id" | "floor">>;
  lines: ReadonlyArray<Pick<DecorLine, "id" | "floor">>;
};

/** Öğe etkin katta mı (kat seçili değilken her öğe etkindir). */
export function onActiveFloor(floor: number, active: ActiveFloor): boolean {
  return active === null || floor === active;
}

/** Etkin kattaki (seçilebilir, sürüklenebilir) masa, dekor ve çizgi anahtarları. */
export function floorKeys(s: FloorSource, active: ActiveFloor): Set<string> {
  return new Set([
    ...s.tables.filter((t) => onActiveFloor(t.floor, active)).map((t) => t.key),
    ...s.elements.filter((e) => onActiveFloor(decorFloor(e), active)).map((e) => decorItemKey(e.id)),
    ...s.lines.filter((l) => onActiveFloor(lineFloor(l), active)).map((l) => lineKey(l.id)),
  ]);
}
