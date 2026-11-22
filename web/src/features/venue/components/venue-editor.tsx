"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { createEditorStore, isLayoutEmpty, type InitialLayout } from "../editor/store";
import type { WriteLayoutResult } from "../layout-core";
import { saveLayoutAction } from "../actions";
import { EditorStoreContext, useEditor, useEditorStore, type TableTypeOption } from "./editor-context";
import { EditorToolbar } from "./editor-toolbar";
import { PropertiesPanel } from "./properties-panel";
import { TemplateDialog, type TemplateOption } from "./template-dialog";
import { useEditorShortcuts } from "./use-editor-shortcuts";

const Loading = () => (
  <div className="flex h-full items-center justify-center text-sm text-muted-foreground" aria-busy="true">
    Tuval yükleniyor…
  </div>
);

// Konva ve three.js yalnızca tarayıcıda çalışır; ayrı paketlere bölünüp tembel yüklenir.
const VenueCanvas = dynamic(() => import("./venue-canvas"), { ssr: false, loading: Loading });
const Venue3DPreview = dynamic(() => import("./venue-3d-preview"), { ssr: false, loading: Loading });

export type VenueEditorProps = {
  eventId: string;
  initial: InitialLayout;
  tableTypes: TableTypeOption[];
  templates: TemplateOption[];
  canEdit: boolean;
  canSaveTemplate: boolean;
};

function toInitial(result: Pick<WriteLayoutResult, "tables" | "decor" | "lockedTableIds">): InitialLayout {
  return {
    tables: result.tables.map((t) => ({
      id: t.id,
      label: t.label,
      capacity: t.capacity,
      tableTypeId: t.tableTypeId,
      x: t.x,
      y: t.y,
      rotation: t.rotation,
      isLoca: t.isLoca,
    })),
    decor: result.decor,
    lockedTableIds: result.lockedTableIds,
  };
}

/** "tables.3.label" biçimli alan hatalarını masa anahtarına göre gruplar. */
function groupTableErrors(fieldErrors: Record<string, string[]>, keys: readonly string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [path, messages] of Object.entries(fieldErrors)) {
    const match = /^tables\.(\d+)\./.exec(path);
    const key = match ? keys[Number(match[1])] : undefined;
    if (key) out[key] = [...(out[key] ?? []), ...messages];
  }
  return out;
}

export function VenueEditor(props: VenueEditorProps) {
  const [store] = useState(() => createEditorStore(props.initial));
  return (
    <EditorStoreContext.Provider value={store}>
      <EditorShell {...props} />
    </EditorStoreContext.Provider>
  );
}

function EditorShell({ eventId, tableTypes, templates, canEdit, canSaveTemplate }: VenueEditorProps) {
  const store = useEditorStore();
  const dirty = useEditor((s) => s.dirty);
  const layoutEmpty = useEditor(isLayoutEmpty);
  const [saving, setSaving] = useState(false);
  const [show3d, setShow3d] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const save = useCallback(async () => {
    const state = store.getState();
    if (!canEdit || saving || !state.dirty) return;
    setSaving(true);
    setMessage(null);
    setErrors({});
    const keys = state.tables.map((t) => t.key);
    try {
      const res = await saveLayoutAction({ eventId, ...state.toSaveInput() });
      if (!res.ok) {
        setErrors(groupTableErrors(res.fieldErrors ?? {}, keys));
        setMessage({ kind: "error", text: res.message });
        return;
      }
      store.getState().load(toInitial(res.data));
      setMessage({ kind: "ok", text: `Yerleşim kaydedildi (${res.data.tables.length} masa, ${res.data.totalCapacity} kişi).` });
    } catch {
      setMessage({ kind: "error", text: "Beklenmeyen bir hata oluştu" });
    } finally {
      setSaving(false);
    }
  }, [store, canEdit, saving, eventId]);

  const onBlocked = useCallback((labels: string[]) => {
    setMessage({ kind: "error", text: `Rezervasyonu veya ataması olan masalar silinemez: ${labels.join(", ")}` });
  }, []);

  useEditorShortcuts({ store, enabled: !templatesOpen, onSave: () => void save(), onBlocked });

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <div className="flex h-[calc(100dvh-9rem)] min-h-[480px] flex-col overflow-hidden rounded-md border border-border">
      <EditorToolbar
        readOnly={!canEdit}
        saving={saving}
        show3d={show3d}
        onToggle3d={() => setShow3d((v) => !v)}
        onSave={() => void save()}
        onOpenTemplates={() => setTemplatesOpen(true)}
        onBlocked={onBlocked}
      />
      {canEdit && layoutEmpty ? (
        <p className="border-b border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
          Henüz masa yok. Araç çubuğundan masa ekleyin ya da bir şablon uygulayın.
        </p>
      ) : null}
      {message ? (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={message.kind === "error" ? "px-3 py-2 text-sm text-destructive" : "px-3 py-2 text-sm text-emerald-600"}
        >
          {message.text}
        </p>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-[320px] flex-1">
          {show3d ? <Venue3DPreview tableTypes={tableTypes} /> : <VenueCanvas readOnly={!canEdit} tableTypes={tableTypes} />}
        </div>
        <PropertiesPanel readOnly={!canEdit} tableTypes={tableTypes} errors={errors} />
      </div>
      <TemplateDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        eventId={eventId}
        templates={templates}
        canApply={canEdit}
        canSave={canSaveTemplate}
        dirty={dirty}
        onApplied={(result) => store.getState().load(toInitial(result))}
        onMessage={(text) => setMessage({ kind: "ok", text })}
      />
    </div>
  );
}
