"use client";

import type { Dispatch } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SELECT_CLASS } from "@/features/users/components/field";
import { INVITATION_SIZES, SIZE_KEYS, type InvitationSizeKey } from "../../elements";
import { BACKGROUND_PRESETS, GRADIENT_PRESETS, isElementType, ELEMENT_LABELS, type EditorAction, type EditorDesign } from "./editor-state";

const ADDABLE = ["text", "guestName", "eventName", "eventDate", "eventTime", "eventLocation", "eventDescription", "image", "logo", "qrcode"] as const;

export function ElementToolbar({ dispatch }: { dispatch: Dispatch<EditorAction> }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Öğe ekle">
      {ADDABLE.map((type) => (
        <Button key={type} type="button" variant="outline" size="sm" onClick={() => isElementType(type) && dispatch({ type: "add", elementType: type, id: crypto.randomUUID() })}>
          + {ELEMENT_LABELS[type]}
        </Button>
      ))}
    </div>
  );
}

function isSizeKey(value: string): value is InvitationSizeKey {
  return (SIZE_KEYS as readonly string[]).includes(value);
}

type Props = {
  design: EditorDesign;
  images: string[];
  dispatch: Dispatch<EditorAction>;
};

export function DesignPanel({ design, images, dispatch }: Props) {
  const set = (patch: Partial<Omit<EditorDesign, "elements">>) => dispatch({ type: "design", patch });
  return (
    <div className="space-y-4">
      <label className="block space-y-1 text-xs">
        <span className="text-muted-foreground">Boyut</span>
        <select className={SELECT_CLASS} value={design.size} onChange={(e) => isSizeKey(e.target.value) && dispatch({ type: "size", size: e.target.value })}>
          {SIZE_KEYS.map((key) => (
            <option key={key} value={key}>
              {INVITATION_SIZES[key].label}
            </option>
          ))}
        </select>
      </label>

      {design.size === "CUSTOM" ? (
        <div className="grid grid-cols-2 gap-2">
          {(["width", "height"] as const).map((key) => (
            <label key={key} className="space-y-1 text-xs">
              <span className="text-muted-foreground">{key === "width" ? "Genişlik" : "Yükseklik"}</span>
              <Input
                type="number"
                min={100}
                max={3000}
                value={design[key]}
                onChange={(e) => Number.isFinite(e.target.valueAsNumber) && set({ [key]: Math.round(e.target.valueAsNumber) })}
              />
            </label>
          ))}
        </div>
      ) : null}

      <div className="space-y-1 text-xs">
        <span className="text-muted-foreground">Arka plan rengi</span>
        <div className="flex flex-wrap items-center gap-2">
          {BACKGROUND_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Arka plan ${color}`}
              aria-pressed={design.backgroundColor === color && !design.backgroundGradient}
              className="size-7 rounded-full border border-border aria-pressed:ring-2 aria-pressed:ring-ring"
              style={{ backgroundColor: color }}
              onClick={() => set({ backgroundColor: color, backgroundGradient: null })}
            />
          ))}
          <input
            type="color"
            aria-label="Özel arka plan rengi"
            className="h-7 w-10 rounded-md border border-input bg-transparent p-0.5"
            value={design.backgroundColor && /^#[0-9a-fA-F]{6}$/.test(design.backgroundColor) ? design.backgroundColor : "#ffffff"}
            onChange={(e) => set({ backgroundColor: e.target.value, backgroundGradient: null })}
          />
        </div>
      </div>

      <div className="space-y-1 text-xs">
        <span className="text-muted-foreground">Geçişli arka plan</span>
        <div className="flex flex-wrap gap-2">
          {GRADIENT_PRESETS.map((preset) => (
            <Button key={preset.value} type="button" size="sm" variant={design.backgroundGradient === preset.value ? "default" : "outline"} onClick={() => set({ backgroundGradient: preset.value })}>
              {preset.label}
            </Button>
          ))}
          <Button type="button" size="sm" variant="ghost" disabled={!design.backgroundGradient} onClick={() => set({ backgroundGradient: null })}>
            Kaldır
          </Button>
        </div>
      </div>

      <label className="block space-y-1 text-xs">
        <span className="text-muted-foreground">Arka plan görseli</span>
        <select className={SELECT_CLASS} value={design.backgroundImage ?? ""} onChange={(e) => set({ backgroundImage: e.target.value || null })}>
          <option value="">Yok</option>
          {images.map((path, index) => (
            <option key={path} value={path}>
              Görsel {index + 1}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
