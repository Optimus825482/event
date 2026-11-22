import { decorKey, isDecorKey, type EditorStore, type MoveResult } from "../editor/store";

export type NoticeKind = "ok" | "error";
export type Notify = (kind: NoticeKind, text: string) => void;

const unplacedSuffix = (labels: readonly string[]) =>
  labels.length > 0 ? ` Uygun yer bulunamadı: ${labels.slice(0, 8).join(", ")}${labels.length > 8 ? "…" : ""}.` : "";

/** Taşıma reddedildiyse kullanıcıya nedenini bildirir. */
export function reportMove(result: MoveResult, notify: Notify): void {
  if (result.ok) return;
  if (result.reason === "collision") {
    notify("error", "Taşınamadı: masalar birbirinin ya da sahne/alanın üstüne binemez.");
  }
}

export function runAutoAlign(store: EditorStore, notify: Notify): void {
  const r = store.getState().autoAlign();
  if (r.moved === 0 && r.unplaced.length === 0) {
    notify("ok", "Hizalanacak masa yok (sabit masalar hariç) ya da masalar zaten hizalı.");
    return;
  }
  const head = r.scoped
    ? `${r.moved} seçili masa hizalandı (sabit masalar korundu).`
    : `Tüm masalar hizalandı (${r.moved}, sabitler hariç).`;
  notify(r.unplaced.length > 0 ? "error" : "ok", head + unplacedSuffix(r.unplaced));
}

export function runSnapToCells(store: EditorStore, notify: Notify): void {
  const r = store.getState().snapToCells();
  notify(
    r.unplaced.length > 0 ? "error" : "ok",
    `${r.moved} masa ızgara hücre merkezine hizalandı (çakışmasız).` + unplacedSuffix(r.unplaced),
  );
}

export function runSpacing(store: EditorStore, gap: number, notify: Notify): void {
  const count = selectedTableKeys(store).length;
  const r = store.getState().setSpacing(gap);
  notify(
    r.unplaced.length > 0 ? "error" : "ok",
    `${count} masa arasındaki aralık ${gap}px olarak ayarlandı.` + unplacedSuffix(r.unplaced),
  );
}

export function runCenterHorizontally(store: EditorStore, notify: Notify, keys?: readonly string[]): void {
  const r = store.getState().centerHorizontally(keys);
  if (r.ok) notify("ok", "Yatay olarak ortalandı.");
  else if (r.reason === "collision") notify("error", "Ortalanamadı: başka bir öğeyle çakışıyor.");
  else notify("error", "Ortalanacak (sabitlenmemiş) seçili öğe yok.");
}

export function selectedTableKeys(store: EditorStore): string[] {
  return store.getState().selection.filter((k) => !isDecorKey(k));
}

/** Seçimin tamamı sabitse true (düğme "Kilidi Aç" olur). */
export function selectionPinned(store: EditorStore, keys: readonly string[]): boolean {
  const s = store.getState();
  const wanted = new Set(keys);
  const flags = [
    ...s.tables.filter((t) => wanted.has(t.key)).map((t) => t.isPinned),
    ...s.elements.filter((e) => wanted.has(decorKey(e.id))).map((e) => e.isPinned === true),
  ];
  return flags.length > 0 && flags.every(Boolean);
}

export function runTogglePin(store: EditorStore, keys: readonly string[], notify: Notify): void {
  if (keys.length === 0) return;
  const pin = !selectionPinned(store, keys);
  store.getState().setPinned(keys, pin);
  notify("ok", pin ? `${keys.length} öğe sabitlendi.` : `${keys.length} öğenin kilidi açıldı.`);
}

/** Seçili masaların tamamı VIP ise true. */
export function selectionVip(store: EditorStore, keys: readonly string[]): boolean {
  const wanted = new Set(keys);
  const tables = store.getState().tables.filter((t) => wanted.has(t.key));
  return tables.length > 0 && tables.every((t) => t.isVip);
}

export function runToggleVip(store: EditorStore, keys: readonly string[], notify: Notify): void {
  const tableKeys = keys.filter((k) => !isDecorKey(k));
  if (tableKeys.length === 0) return;
  const vip = !selectionVip(store, tableKeys);
  store.getState().setVip(tableKeys, vip);
  notify("ok", vip ? `${tableKeys.length} masa VIP yapıldı.` : `${tableKeys.length} masadan VIP kaldırıldı.`);
}

export function runDelete(store: EditorStore, notify: Notify): void {
  const { blocked } = store.getState().deleteSelection();
  if (blocked.length > 0) notify("error", `Rezervasyonu veya ataması olan masalar silinemez: ${blocked.join(", ")}`);
}
