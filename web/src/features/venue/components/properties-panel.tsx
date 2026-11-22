"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import { isDecorKey, decorKey } from "../editor/store";
import { LABEL_MAX, MAX_TABLE_CAPACITY } from "../schemas";
import { useEditor, useEditorStore, type TableTypeOption } from "./editor-context";

type Props = {
  readOnly: boolean;
  tableTypes: readonly TableTypeOption[];
  /** Son kayıttan dönen alan hataları, masa anahtarına göre. */
  errors: Record<string, string[]>;
};

const fieldClass =
  "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

/** Odaktan çıkınca (ya da Enter ile) yazılan alan: her tuş vuruşu geçmişe girmesin. */
function CommitField({
  label,
  value,
  type = "text",
  disabled,
  onCommit,
  ...rest
}: {
  label: string;
  value: string | number;
  type?: "text" | "number";
  disabled: boolean;
  onCommit: (value: string) => void;
  min?: number;
  max?: number;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <input
        key={String(value)}
        id={id}
        type={type}
        defaultValue={value}
        disabled={disabled}
        className={fieldClass}
        onBlur={(e) => {
          if (e.currentTarget.value !== String(value)) onCommit(e.currentTarget.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        {...rest}
      />
    </div>
  );
}

function toInt(value: string, fallback: number): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function PropertiesPanel({ readOnly, tableTypes, errors }: Props) {
  const store = useEditorStore();
  const selection = useEditor((s) => s.selection);
  const tables = useEditor((s) => s.tables);
  const elements = useEditor((s) => s.elements);
  const typeId = useId();
  const selectedTables = tables.filter((t) => selection.includes(t.key));
  const selectedDecor = elements.filter((e) => selection.includes(decorKey(e.id)));
  const capacity = tables.reduce((sum, t) => sum + t.capacity, 0);
  const keys = selectedTables.map((t) => t.key);
  const first = selectedTables[0];
  const single = selectedTables.length === 1 && selectedDecor.length === 0 ? first : undefined;
  const decor = selectedDecor.length === 1 && selectedTables.length === 0 ? selectedDecor[0] : undefined;
  const update = store.getState().updateTables;
  const errorEntries = Object.entries(errors);

  return (
    <aside className="flex w-full flex-col gap-4 overflow-y-auto border-l border-border bg-background p-3 text-sm lg:w-72">
      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-border p-2">
          <dt className="text-xs text-muted-foreground">Masa</dt>
          <dd className="text-lg font-semibold">{tables.length}</dd>
        </div>
        <div className="rounded-md border border-border p-2">
          <dt className="text-xs text-muted-foreground">Kapasite</dt>
          <dd className="text-lg font-semibold">{capacity}</dd>
        </div>
      </dl>

      {errorEntries.length > 0 ? (
        <ul role="alert" className="space-y-1 rounded-md border border-destructive/50 p-2 text-destructive">
          {errorEntries.map(([key, messages]) => (
            <li key={key}>
              <button type="button" className="text-left underline" onClick={() => store.getState().select([key])}>
                {tables.find((t) => t.key === key)?.label ?? "Masa"}
              </button>
              : {messages.join(", ")}
            </li>
          ))}
        </ul>
      ) : null}

      {selection.length === 0 ? (
        <p className="text-muted-foreground">
          Düzenlemek için bir öğe seçin. Shift ile çoklu seçim yapabilir, boş alanda sürükleyerek alan seçebilirsiniz.
        </p>
      ) : null}

      {single ? (
        <section className="space-y-3" aria-label="Masa özellikleri">
          <h2 className="font-medium">Masa {single.locked ? "(rezervasyonlu, silinemez)" : ""}</h2>
          <CommitField
            label="Etiket"
            value={single.label}
            maxLength={LABEL_MAX}
            disabled={readOnly}
            onCommit={(v) => v.trim() && update(keys, { label: v.trim() })}
          />
          <CommitField
            label="Kapasite"
            type="number"
            min={1}
            max={MAX_TABLE_CAPACITY}
            value={single.capacity}
            disabled={readOnly}
            onCommit={(v) => update(keys, { capacity: toInt(v, single.capacity) })}
          />
          <CommitField
            label="Dönüş (°)"
            type="number"
            value={single.rotation}
            disabled={readOnly}
            onCommit={(v) => update(keys, { rotation: toInt(v, single.rotation) })}
          />
        </section>
      ) : null}

      {selectedTables.length > 1 ? (
        <section className="space-y-3" aria-label="Toplu masa düzenleme">
          <h2 className="font-medium">{selectedTables.length} masa seçili</h2>
          <CommitField
            label="Kapasite (hepsi)"
            type="number"
            min={1}
            max={MAX_TABLE_CAPACITY}
            value={first?.capacity ?? 8}
            disabled={readOnly}
            onCommit={(v) => update(keys, { capacity: toInt(v, first?.capacity ?? 8) })}
          />
        </section>
      ) : null}

      {selectedTables.length > 0 ? (
        <section className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor={typeId}>Masa tipi</Label>
            <select
              id={typeId}
              className={fieldClass}
              disabled={readOnly}
              value={selectedTables.every((t) => t.tableTypeId === first?.tableTypeId) ? (first?.tableTypeId ?? "") : "__mixed"}
              onChange={(e) => {
                const value = e.currentTarget.value;
                if (value === "__mixed") return;
                const type = tableTypes.find((t) => t.id === value);
                update(keys, type ? { tableTypeId: type.id } : { tableTypeId: null });
              }}
            >
              <option value="__mixed" disabled hidden>
                Karışık
              </option>
              <option value="">Tipsiz</option>
              {tableTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.capacity} kişi){t.isActive ? "" : " - pasif"}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={selectedTables.every((t) => t.isLoca)}
              onChange={(e) => update(keys, { isLoca: e.currentTarget.checked })}
            />
            Loca
          </label>
        </section>
      ) : null}

      {decor ? (
        <section className="space-y-3" aria-label="Öğe özellikleri">
          <h2 className="font-medium">
            {{ stage: "Sahne", area: "Alan", wall: "Duvar", label: "Metin" }[decor.kind]}
          </h2>
          <CommitField
            label="Metin"
            value={decor.label}
            maxLength={60}
            disabled={readOnly}
            onCommit={(v) => store.getState().updateDecor(decorKey(decor.id), { label: v })}
          />
          <div className="space-y-1">
            <Label htmlFor={`${typeId}-color`}>Renk</Label>
            <input
              id={`${typeId}-color`}
              type="color"
              disabled={readOnly}
              defaultValue={decor.color ?? "#64748b"}
              key={decor.id + (decor.color ?? "")}
              onBlur={(e) => store.getState().updateDecor(decorKey(decor.id), { color: e.currentTarget.value })}
              className="h-8 w-16 rounded border border-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CommitField
              label="Genişlik"
              type="number"
              min={4}
              value={Math.round(decor.width)}
              disabled={readOnly}
              onCommit={(v) => store.getState().updateDecor(decorKey(decor.id), { width: Math.max(4, toInt(v, decor.width)) })}
            />
            <CommitField
              label="Yükseklik"
              type="number"
              min={4}
              value={Math.round(decor.height)}
              disabled={readOnly}
              onCommit={(v) =>
                store.getState().updateDecor(decorKey(decor.id), { height: Math.max(4, toInt(v, decor.height)) })
              }
            />
          </div>
        </section>
      ) : null}

      {selection.some(isDecorKey) && selectedTables.length > 0 ? (
        <p className="text-muted-foreground">Masa ve dekor birlikte seçiliyken yalnızca taşıma ve döndürme yapılabilir.</p>
      ) : null}
    </aside>
  );
}
