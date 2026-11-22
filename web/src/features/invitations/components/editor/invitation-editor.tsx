"use client";

import { useMemo, useReducer, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ActionResult } from "@/lib/action";
import type { FieldValues } from "../../elements";
import { DesignPanel, ElementToolbar } from "./design-panel";
import { EditorCanvas } from "./editor-canvas";
import { PREVIEW_FIELDS, editorReducer, type EditorDesign } from "./editor-state";
import { ImagePanel } from "./image-panel";
import { PropertiesPanel } from "./properties-panel";

export type EventImages = { eventId: string; initial: string[]; onChange?: (images: string[]) => void };

type Props = {
  initial: EditorDesign;
  eventName: string;
  eventDescription?: string;
  /** Tasarımı kaydeder; sonuç mesajı editörde gösterilir. */
  onSave: (design: EditorDesign) => Promise<ActionResult<unknown>>;
  /** Yalnızca etkinlik modunda: görsel yükleme paneli. */
  eventImages?: EventImages;
  /** Kaydet düğmesinin yanına konan ek alanlar (ör. şablon adı). */
  header?: ReactNode;
  saveLabel?: string;
};

type Status = { ok: boolean; message: string } | null;

export function uploadSrc(uploadPath: string): string {
  return `/api/uploads/${uploadPath}`;
}

export function InvitationEditor({ initial, eventName, eventDescription = "", onSave, eventImages, header, saveLabel = "Kaydet" }: Props) {
  const [state, dispatch] = useReducer(editorReducer, { design: initial, selectedId: null, dirty: false });
  const [zoom, setZoom] = useState(0.8);
  const [images, setImages] = useState<string[]>(eventImages?.initial ?? []);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const fields = useMemo<FieldValues>(
    () => ({ ...PREVIEW_FIELDS, eventName, eventDescription }),
    [eventName, eventDescription],
  );
  const selected = state.design.elements.find((e) => e.id === state.selectedId) ?? null;

  async function save() {
    setPending(true);
    setStatus(null);
    const res = await onSave(state.design);
    setPending(false);
    if (res.ok) {
      dispatch({ type: "reset", design: state.design });
      setStatus({ ok: true, message: "Kaydedildi" });
    } else {
      const first = res.fieldErrors ? Object.values(res.fieldErrors)[0]?.[0] : undefined;
      setStatus({ ok: false, message: first ? `${res.message}: ${first}` : res.message });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">{header}</div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Yakınlaştırma
            <input type="range" min={0.3} max={1.2} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Yakınlaştırma" />
            {Math.round(zoom * 100)}%
          </label>
          <Button type="button" onClick={() => void save()} disabled={pending || !state.dirty} className="bg-blue-600 text-white hover:bg-blue-700">
            {pending ? "Kaydediliyor..." : saveLabel}
          </Button>
        </div>
      </div>
      {status ? (
        <p role={status.ok ? "status" : "alert"} className={status.ok ? "text-sm text-green-400" : "text-sm text-red-400"}>
          {status.message}
        </p>
      ) : state.dirty ? (
        <p className="text-sm text-amber-400">Kaydedilmemiş değişiklikler var.</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <EditorCanvas design={state.design} selectedId={state.selectedId} zoom={zoom} fields={fields} imageSrc={uploadSrc} dispatch={dispatch} />
        <aside className="space-y-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          <ElementToolbar dispatch={dispatch} />
          <Tabs defaultValue="element">
            <TabsList>
              <TabsTrigger value="element">Öğe</TabsTrigger>
              <TabsTrigger value="design">Tasarım</TabsTrigger>
              {eventImages ? <TabsTrigger value="images">Görseller</TabsTrigger> : null}
            </TabsList>
            <TabsContent value="element" className="pt-3">
              <PropertiesPanel element={selected} images={images} dispatch={dispatch} />
            </TabsContent>
            <TabsContent value="design" className="pt-3">
              <DesignPanel design={state.design} images={images} dispatch={dispatch} />
            </TabsContent>
            {eventImages ? (
              <TabsContent value="images" className="pt-3">
                <ImagePanel
                  eventId={eventImages.eventId}
                  images={images}
                  imageSrc={uploadSrc}
                  onChange={(next) => {
                    setImages(next);
                    eventImages.onChange?.(next);
                  }}
                  onRemoved={(path) => {
                    for (const e of state.design.elements) if (e.imageUrl === path) dispatch({ type: "patch", id: e.id, patch: { imageUrl: undefined } });
                    if (state.design.backgroundImage === path) dispatch({ type: "design", patch: { backgroundImage: null } });
                  }}
                />
              </TabsContent>
            ) : null}
          </Tabs>
        </aside>
      </div>
    </div>
  );
}
