"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import { decorKey } from "../editor/store";
import type { DecorElement } from "../schemas";
import { ChoiceButton, CommitField, fieldClass } from "./commit-field";
import {
  BORDER_SWATCHES,
  BORDER_WIDTHS,
  DECOR_KIND_TITLE,
  FILL_SWATCHES,
  FONT_FAMILY_OPTIONS,
  FONT_SIZE_OPTIONS,
  ICON_OPTIONS,
  ICON_PATHS,
  resolveDecorStyle,
  supportsFullStyle,
  TEXT_DIRECTION_OPTIONS,
} from "./decor-style";
import { useEditorStore } from "./editor-context";
import { FLOOR_OPTIONS } from "./table-visual";

type DecorPatch = Partial<
  Pick<
    DecorElement,
    | "label"
    | "color"
    | "width"
    | "height"
    | "rotation"
    | "borderColor"
    | "borderWidth"
    | "icon"
    | "fontSize"
    | "fontFamily"
    | "textDirection"
    | "tooltip"
    | "isPinned"
    | "floor"
  >
>;

function IconSvg({ icon, size, color }: { icon: keyof typeof ICON_PATHS; size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[icon]} />
    </svg>
  );
}

/** Canlı önizleme: tuvaldeki görünümün HTML karşılığı (renk, çerçeve, simge, yazı, yön). */
export function DecorPreview({ element }: { element: DecorElement }) {
  const style = resolveDecorStyle(element);
  const vertical = style.direction !== "horizontal";
  return (
    <div
      data-testid="decor-preview"
      className="relative flex h-12 items-center justify-center gap-2 overflow-hidden rounded"
      style={{ border: `${style.borderWidth}px solid ${style.border}` }}
    >
      <div className="absolute inset-0" style={{ background: style.fill, opacity: style.opacity }} />
      <div className="relative flex items-center gap-2 text-white" style={{ fontFamily: style.fontCss, fontSize: Math.min(style.fontPx, 22), fontWeight: 700 }}>
        {style.icon ? <IconSvg icon={style.icon} size={Math.min(style.fontPx * 1.4, 24)} color="#ffffff" /> : null}
        <span
          style={vertical ? { writingMode: "vertical-rl", transform: style.direction === "vertical-up" ? "rotate(180deg)" : undefined, maxHeight: 40 } : undefined}
        >
          {element.label || "Önizleme"}
        </span>
      </div>
    </div>
  );
}

function Swatches({
  legend,
  swatches,
  value,
  disabled,
  onPick,
}: {
  legend: string;
  swatches: ReadonlyArray<{ label: string; color: string }>;
  value: string | undefined;
  disabled: boolean;
  onPick: (color: string) => void;
}) {
  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {swatches.map((s) => (
          <ChoiceButton
            key={s.color}
            pressed={value?.toLowerCase() === s.color}
            disabled={disabled}
            label={s.label}
            className="size-6"
            style={{ background: s.color }}
            onClick={() => onPick(s.color)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function Segmented<T extends string | number>({
  legend,
  options,
  value,
  disabled,
  onPick,
}: {
  legend: string;
  options: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  disabled: boolean;
  onPick: (id: T) => void;
}) {
  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <ChoiceButton key={String(o.id)} pressed={o.id === value} disabled={disabled} label={o.label} className="px-2 py-1" onClick={() => onPick(o.id)}>
            {o.label}
          </ChoiceButton>
        ))}
      </div>
    </fieldset>
  );
}

/** Sahne/alan/duvar/metin öğesi özellikleri ve stil denetimleri. */
export function DecorStyleSection({ element, readOnly }: { element: DecorElement; readOnly: boolean }) {
  const store = useEditorStore();
  const floorId = useId();
  const colorId = useId();
  const key = decorKey(element.id);
  const apply = (patch: DecorPatch) => store.getState().updateDecor(key, patch);
  const style = resolveDecorStyle(element);
  const full = supportsFullStyle(element.kind);
  const fontOptions = FONT_FAMILY_OPTIONS.map((o) => ({ id: o.id, label: o.label }));

  return (
    <section className="space-y-3" aria-label="Öğe özellikleri">
      <h2 className="font-medium">{DECOR_KIND_TITLE[element.kind]}</h2>
      {full ? <DecorPreview element={element} /> : null}
      <CommitField label="Metin" value={element.label} maxLength={60} placeholder="Kısa metin..." disabled={readOnly} onCommit={(v) => apply({ label: v })} />
      {full ? (
        <CommitField
          label="Etiket (tooltip)"
          value={element.tooltip ?? ""}
          maxLength={120}
          placeholder="Fareyle üzerine gelince görünür"
          disabled={readOnly}
          onCommit={(v) => apply({ tooltip: v.trim() === "" ? undefined : v.trim() })}
        />
      ) : null}
      <Swatches legend="Dolgu Rengi" swatches={FILL_SWATCHES} value={element.color} disabled={readOnly} onPick={(color) => apply({ color })} />
      <div className="flex items-center gap-2">
        <Label htmlFor={colorId}>Özel renk</Label>
        <input
          id={colorId}
          type="color"
          disabled={readOnly}
          defaultValue={element.color ?? "#64748b"}
          key={element.id + (element.color ?? "")}
          onBlur={(e) => apply({ color: e.currentTarget.value })}
          className="h-8 w-16 rounded border border-input"
        />
      </div>
      {full ? (
        <>
          <Swatches legend="Border Rengi" swatches={BORDER_SWATCHES} value={element.borderColor} disabled={readOnly} onPick={(borderColor) => apply({ borderColor })} />
          <Segmented
            legend="Border Kalınlığı"
            options={[{ id: 0, label: "Yok" }, ...BORDER_WIDTHS.map((w) => ({ id: w as number, label: String(w) }))]}
            value={element.borderWidth ?? 1}
            disabled={readOnly}
            onPick={(borderWidth) => apply({ borderWidth })}
          />
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">İkon</legend>
            <div className="grid grid-cols-4 gap-1">
              {ICON_OPTIONS.map((o) => (
                <ChoiceButton
                  key={o.id}
                  pressed={(element.icon ?? "none") === o.id}
                  disabled={readOnly}
                  label={o.label}
                  className="flex h-10 flex-col items-center justify-center"
                  onClick={() => apply({ icon: o.id })}
                >
                  {o.id === "none" ? <span>Yok</span> : <IconSvg icon={o.id} size={18} color="currentColor" />}
                </ChoiceButton>
              ))}
            </div>
          </fieldset>
          <Segmented legend="Boyut" options={FONT_SIZE_OPTIONS} value={element.fontSize ?? "md"} disabled={readOnly} onPick={(fontSize) => apply({ fontSize })} />
          <Segmented legend="Yazı Tipi" options={fontOptions} value={element.fontFamily ?? "sans"} disabled={readOnly} onPick={(fontFamily) => apply({ fontFamily })} />
          <Segmented legend="Yazı Yönü" options={TEXT_DIRECTION_OPTIONS} value={style.direction} disabled={readOnly} onPick={(textDirection) => apply({ textDirection })} />
        </>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <CommitField
          label="Genişlik"
          type="number"
          min={4}
          value={Math.round(element.width)}
          disabled={readOnly}
          onCommit={(v) => apply({ width: Math.max(4, Number.parseInt(v, 10) || element.width) })}
        />
        <CommitField
          label="Yükseklik"
          type="number"
          min={4}
          value={Math.round(element.height)}
          disabled={readOnly}
          onCommit={(v) => apply({ height: Math.max(4, Number.parseInt(v, 10) || element.height) })}
        />
      </div>
      {full ? (
        <div className="space-y-2">
          <button
            type="button"
            aria-pressed={element.isPinned === true}
            disabled={readOnly}
            onClick={() => apply({ isPinned: element.isPinned !== true })}
            className={`w-full rounded-md border px-2 py-1.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${
              element.isPinned ? "border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : "border-input hover:bg-accent"
            }`}
          >
            {element.isPinned ? "Kilidi Aç" : "Sabitle"}
          </button>
          <div className="space-y-1">
            <Label htmlFor={floorId}>Kat</Label>
            <select
              id={floorId}
              className={fieldClass}
              disabled={readOnly}
              value={element.floor ?? 1}
              onChange={(e) => apply({ floor: Number(e.currentTarget.value) })}
            >
              {FLOOR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </section>
  );
}
