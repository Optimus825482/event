"use client";

import { ArrowDown, ArrowUp, Copy, Trash2 } from "lucide-react";
import type { Dispatch } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SELECT_CLASS } from "@/features/users/components/field";
import type { InvitationElement } from "../../elements";
import { ELEMENT_LABELS, FONT_OPTIONS, type EditorAction } from "./editor-state";

type Props = {
  element: InvitationElement | null;
  /** Etkinliğe yüklenmiş görseller (görsel öğesi için seçilebilir). */
  images: string[];
  dispatch: Dispatch<EditorAction>;
};

function NumberField({ label, value, onChange, min, max, step }: { label: string; value: number | undefined; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <label className="space-y-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Input
        type="number"
        value={value ?? ""}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const next = e.target.valueAsNumber;
          if (Number.isFinite(next)) onChange(next);
        }}
      />
    </label>
  );
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function ColorField({ label, value, onChange }: { label: string; value: string | undefined; onChange: (v: string | undefined) => void }) {
  return (
    <label className="space-y-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          className="h-9 w-12 rounded-md border border-input bg-transparent p-1"
          value={value && HEX.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)} disabled={!value}>
          Temizle
        </Button>
      </div>
    </label>
  );
}

export function PropertiesPanel({ element, images, dispatch }: Props) {
  if (!element) {
    return <p className="text-sm text-muted-foreground">Düzenlemek için tuvalden bir öğe seçin ya da yeni bir öğe ekleyin.</p>;
  }
  const patch = (p: Partial<InvitationElement>) => dispatch({ type: "patch", id: element.id, patch: p });
  const textual = element.type !== "qrcode" && element.type !== "image" && element.type !== "logo";
  const hasImage = element.type === "image";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{ELEMENT_LABELS[element.type]}</h3>
        <div className="flex gap-1">
          <Button type="button" variant="outline" size="icon-sm" aria-label="Öne getir" onClick={() => dispatch({ type: "layer", id: element.id, direction: "up" })}>
            <ArrowUp />
          </Button>
          <Button type="button" variant="outline" size="icon-sm" aria-label="Arkaya gönder" onClick={() => dispatch({ type: "layer", id: element.id, direction: "down" })}>
            <ArrowDown />
          </Button>
          <Button type="button" variant="outline" size="icon-sm" aria-label="Çoğalt" onClick={() => dispatch({ type: "duplicate", id: element.id, newId: crypto.randomUUID() })}>
            <Copy />
          </Button>
          <Button type="button" variant="destructive" size="icon-sm" aria-label="Öğeyi sil" onClick={() => dispatch({ type: "remove", id: element.id })}>
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <NumberField label="X" value={element.x} onChange={(x) => patch({ x })} />
        <NumberField label="Y" value={element.y} onChange={(y) => patch({ y })} />
        <NumberField label="Genişlik" value={element.width} min={10} onChange={(width) => patch({ width })} />
        <NumberField label="Yükseklik" value={element.height} min={10} onChange={(height) => patch({ height })} />
        <NumberField label="Döndürme" value={element.rotation ?? 0} min={-360} max={360} onChange={(rotation) => patch({ rotation })} />
        <NumberField label="Saydamlık (0-1)" value={element.opacity ?? 1} min={0} max={1} step={0.1} onChange={(opacity) => patch({ opacity })} />
      </div>

      {textual ? (
        <div className="space-y-2">
          <label className="block space-y-1 text-xs">
            <span className="text-muted-foreground">İçerik ({"{{guestName}}"}, {"{{eventName}}"}, {"{{tableLabel}}"} kullanılabilir)</span>
            <Textarea value={element.content ?? ""} maxLength={2000} onChange={(e) => patch({ content: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Yazı boyutu" value={element.fontSize} min={8} max={72} onChange={(fontSize) => patch({ fontSize })} />
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Yazı tipi</span>
              <select className={SELECT_CLASS} value={element.fontFamily ?? "Inter"} onChange={(e) => patch({ fontFamily: e.target.value })}>
                {FONT_OPTIONS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Kalınlık</span>
              <select className={SELECT_CLASS} value={element.fontWeight ?? "normal"} onChange={(e) => patch({ fontWeight: e.target.value })}>
                <option value="normal">Normal</option>
                <option value="600">Yarı kalın</option>
                <option value="bold">Kalın</option>
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Hizalama</span>
              <select className={SELECT_CLASS} value={element.textAlign ?? "left"} onChange={(e) => patch({ textAlign: e.target.value === "center" ? "center" : e.target.value === "right" ? "right" : "left" })}>
                <option value="left">Sol</option>
                <option value="center">Orta</option>
                <option value="right">Sağ</option>
              </select>
            </label>
          </div>
          <ColorField label="Yazı rengi" value={element.color} onChange={(color) => patch({ color })} />
        </div>
      ) : null}

      {hasImage ? (
        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground">Görsel</span>
          <select className={SELECT_CLASS} value={element.imageUrl ?? ""} onChange={(e) => patch({ imageUrl: e.target.value || undefined })}>
            <option value="">Seçin</option>
            {images.map((path, index) => (
              <option key={path} value={path}>
                Görsel {index + 1}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <ColorField label="Arka plan rengi" value={element.backgroundColor} onChange={(backgroundColor) => patch({ backgroundColor })} />
    </div>
  );
}
