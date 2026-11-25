"use client";

import { useId, useState } from "react";
import { Label } from "@/components/ui/label";
import { effectiveTableSize } from "../editor/geometry";
import type { EditorTable } from "../editor/store";
import { ChoiceButton, fieldClass } from "./commit-field";
import { useEditorStore } from "./editor-context";
import { equalizeTargets, FLOOR_OPTIONS, floorLabel, SIZE_PRESETS, SIZE_SLIDER_MAX, SIZE_SLIDER_MIN } from "./table-visual";

type Props = {
  tables: readonly EditorTable[];
  allTables: readonly EditorTable[];
  readOnly: boolean;
  /** Seçimde donmuş masa var: kat salt-okunur (`frozenFieldNames`). */
  floorLocked?: boolean;
};

const sizeOf = (t: EditorTable) => effectiveTableSize({ size: t.size, capacity: t.capacity, isLoca: t.isLoca });

/** Aralığı fareyi/klavyeyi bırakınca işler; sürüklerken geçmişe her adım yazılmaz. */
function SizeSlider({ value, disabled, onCommit }: { value: number; disabled: boolean; onCommit: (size: number) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>
        Özel boyut: <span className="font-semibold">{draft} px</span>
      </Label>
      <input
        id={id}
        type="range"
        min={SIZE_SLIDER_MIN}
        max={SIZE_SLIDER_MAX}
        step={1}
        value={draft}
        disabled={disabled}
        aria-valuetext={`${draft} piksel`}
        className="w-full"
        onChange={(e) => setDraft(Number(e.currentTarget.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
    </div>
  );
}

/** VIP, sabitleme, kat ve boyut denetimleri (tek ya da çoklu masa seçimi). */
export function TableAttributesSection({ tables, allTables, readOnly, floorLocked = false }: Props) {
  const store = useEditorStore();
  const floorId = useId();
  const [notice, setNotice] = useState("");
  const keys = tables.map((t) => t.key);
  const update = store.getState().updateTables;
  const allVip = tables.every((t) => t.isVip);
  const allPinned = tables.every((t) => t.isPinned);
  const first = tables[0];
  if (!first) return null;
  const sizes = tables.map(sizeOf);
  const sameSize = sizes.every((s) => s === sizes[0]);
  const shown = Math.round(sizes[0] ?? 40);
  const floors = new Set(tables.map((t) => t.floor));
  const floorValue = floors.size === 1 ? String(first.floor) : "__mixed";
  const single = tables.length === 1 ? first : undefined;
  const targets = single ? equalizeTargets(allTables, single.key) : [];
  const customSized = tables.some((t) => t.size !== null);
  const equalize = () => {
    if (!single) return;
    const size = Math.round(sizeOf(single));
    update([single.key, ...targets], { size });
    setNotice(`${targets.length + 1} masa ${size} px olarak eşitlendi`);
  };

  return (
    <section className="space-y-3" aria-label="Masa görünümü">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-pressed={allVip}
          disabled={readOnly}
          onClick={() => update(keys, { isVip: !allVip })}
          className={`rounded-md border px-2 py-1.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${
            allVip ? "border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : "border-input hover:bg-accent"
          }`}
        >
          {allVip ? "VIP Kaldır" : "VIP Yap"}
        </button>
        <button
          type="button"
          aria-pressed={allPinned}
          disabled={readOnly}
          onClick={() => update(keys, { isPinned: !allPinned })}
          className={`rounded-md border px-2 py-1.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${
            allPinned ? "border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : "border-input hover:bg-accent"
          }`}
        >
          {allPinned ? "Kilidi Aç" : "Sabitle"}
        </button>
      </div>
      {tables.some((t) => t.isVip) && !allVip ? <p className="text-xs text-muted-foreground">Seçimin bir kısmı VIP.</p> : null}

      <div className="space-y-1">
        <Label htmlFor={floorId}>Kat</Label>
        <select
          id={floorId}
          className={fieldClass}
          disabled={readOnly || floorLocked}
          value={floorValue}
          onChange={(e) => {
            const value = Number(e.currentTarget.value);
            if (Number.isInteger(value)) update(keys, { floor: value });
          }}
        >
          <option value="__mixed" disabled hidden>
            Karışık
          </option>
          {FLOOR_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          {first.floor > 3 && floors.size === 1 ? <option value={first.floor}>{floorLabel(first.floor)}</option> : null}
        </select>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Masa boyutu{sameSize ? "" : " (karışık)"}</legend>
        <div className="grid grid-cols-3 gap-1">
          {SIZE_PRESETS.map((p) => (
            <ChoiceButton
              key={p.id}
              pressed={sameSize && shown === p.size}
              disabled={readOnly}
              label={`${p.label} ${p.size} piksel`}
              className="px-1 py-1.5"
              onClick={() => update(keys, { size: p.size })}
            >
              {p.label} <span className="text-muted-foreground">{p.size}px</span>
            </ChoiceButton>
          ))}
        </div>
        <SizeSlider
          key={`${keys.join(",")}:${shown}`}
          value={shown}
          disabled={readOnly}
          onCommit={(size) => update(keys, { size })}
        />
        {customSized ? (
          <button
            type="button"
            disabled={readOnly}
            className="text-xs underline disabled:opacity-60"
            onClick={() => update(keys, { size: null })}
          >
            Otomatik boyuta dön (kapasiteye göre)
          </button>
        ) : null}
        {single ? (
          <button
            type="button"
            disabled={readOnly || targets.length === 0}
            className="w-full rounded-md border border-input px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-60"
            onClick={equalize}
          >
            Aynı Tip Masaları Eşitle{targets.length > 0 ? ` (${targets.length})` : ""}
          </button>
        ) : null}
        <p role="status" className="text-xs text-muted-foreground">
          {notice}
        </p>
      </fieldset>
    </section>
  );
}
