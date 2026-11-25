"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDraftTime } from "../editor/draft";
import { groupsByTable, type TableGroupInfo } from "../editor/groups";
import { DEFAULT_VIEW_SETTINGS, type ViewSettings } from "../editor/view-chrome";
import type { Point } from "../editor/geometry";
import { editorLock, type EditorLock } from "../editor/lock";
import { createEditorStore, isLayoutEmpty, type InitialLayout } from "../editor/store";
import type { TableShape } from "../schemas";
import type { WriteLayoutResult } from "../layout-core";
import { saveLayoutAction } from "../actions";
import { AddElementsDialog, type AddRequest } from "./add-elements-dialog";
import { DraftRecoveryDialog } from "./draft-recovery-dialog";
import type { Notify } from "./editor-commands";
import { EditorLockContext, EditorStoreContext, tableShapeOf, useEditor, useEditorStore, type TableTypeOption } from "./editor-context";
import { EditorToolbar } from "./editor-toolbar";
import { PropertiesPanel } from "./properties-panel";
import { TemplateDialog, type TemplateOption } from "./template-dialog";
import { SpacingDialog } from "./spacing-dialog";
import { useEditorShortcuts } from "./use-editor-shortcuts";
import { useFullscreen } from "./use-fullscreen";
import { useLayoutDraft } from "./use-layout-draft";

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
  /** Oturumdaki kullanıcı: taslaklar etkinlik + kullanıcı başına saklanır. */
  userId: string;
  initial: InitialLayout;
  tableTypes: TableTypeOption[];
  templates: TemplateOption[];
  canEdit: boolean;
  canSaveTemplate: boolean;
  /**
   * Satış kilidi görünümü; yetkili olan sunucudur, editör yalnızca kullanıcıyı önceden bilgilendirir.
   * Sunucu sayfasından geçtiği için serileştirilebilir (dizi); `Set` istemcide kurulur.
   */
  lock: { locked: boolean; frozenTableIds: string[] };
  /** Ekip masa grupları (planda halka); verilmezse gösterilmez. */
  tableGroups?: readonly TableGroupInfo[];
  /** Izgara boyutu / yapışma / görünürlük varsayılanları (sistem ayarları). */
  viewSettings?: ViewSettings;
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
      isVip: t.isVip,
      isPinned: t.isPinned,
      size: t.size,
      floor: t.floor,
      sortNumber: t.sortNumber,
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
  const lock = useMemo(
    () => editorLock({ layoutLocked: props.lock.locked, frozenTableIds: props.lock.frozenTableIds }),
    [props.lock.locked, props.lock.frozenTableIds],
  );
  const [store] = useState(() =>
    createEditorStore({ ...props.initial, frozenTableIds: [...lock.frozen] }, props.viewSettings ?? DEFAULT_VIEW_SETTINGS),
  );
  return (
    <EditorStoreContext.Provider value={store}>
      <EditorLockContext.Provider value={lock}>
        <EditorShell {...props} lock={lock} />
      </EditorLockContext.Provider>
    </EditorStoreContext.Provider>
  );
}

function EditorShell({
  eventId,
  userId,
  tableTypes,
  templates,
  canEdit,
  canSaveTemplate,
  tableGroups,
  lock,
}: Omit<VenueEditorProps, "lock"> & { lock: EditorLock }) {
  const store = useEditorStore();
  const dirty = useEditor((s) => s.dirty);
  const layoutEmpty = useEditor(isLayoutEmpty);
  const [saving, setSaving] = useState(false);
  const [show3d, setShow3d] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [addRequest, setAddRequest] = useState<(AddRequest & { id: number }) | null>(null);
  const [spacingOpen, setSpacingOpen] = useState(false);
  const { fullscreen, toggle: toggleFullscreen } = useFullscreen();
  const groups = useMemo(() => groupsByTable(tableGroups ?? []), [tableGroups]);
  const draft = useLayoutDraft({ store, eventId, userId, enabled: canEdit });
  const clearDraft = draft.clear;
  const notify: Notify = useCallback((kind, text) => setMessage({ kind, text }), []);
  const openAdd = useCallback((kind: AddRequest["kind"], start?: Point) => setAddRequest({ kind, start, id: Date.now() }), []);

  useEffect(() => {
    const shapes: Record<string, TableShape> = {};
    for (const t of tableTypes) shapes[t.id] = tableShapeOf(t);
    store.getState().setTableShapes(shapes);
  }, [store, tableTypes]);

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
      clearDraft();
      setMessage({ kind: "ok", text: `Yerleşim kaydedildi (${res.data.tables.length} masa, ${res.data.totalCapacity} kişi).` });
    } catch {
      setMessage({ kind: "error", text: "Beklenmeyen bir hata oluştu" });
    } finally {
      setSaving(false);
    }
  }, [store, canEdit, saving, eventId, clearDraft]);

  const dialogOpen = templatesOpen || addRequest !== null || spacingOpen || draft.recovery !== null;
  useEditorShortcuts({ store, enabled: !dialogOpen, onSave: () => void save(), notify, lock });

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex h-screen flex-col overflow-hidden bg-background"
          : "flex h-[calc(100dvh-9rem)] min-h-[480px] flex-col overflow-hidden rounded-md border border-border"
      }
    >
      <EditorToolbar
        readOnly={!canEdit}
        saving={saving}
        show3d={show3d}
        fullscreen={fullscreen}
        onToggleFullscreen={toggleFullscreen}
        onToggle3d={() => setShow3d((v) => !v)}
        onSave={() => void save()}
        onOpenTemplates={() => setTemplatesOpen(true)}
        notify={notify}
        onOpenAdd={(kind) => openAdd(kind)}
        onOpenSpacing={() => setSpacingOpen(true)}
      />
      {lock.locked ? (
        <p role="status" className="border-b border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          Satış başladı: rezervasyonlu masalar kilitli.
        </p>
      ) : null}
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
          {show3d ? (
            <Venue3DPreview tableTypes={tableTypes} />
          ) : (
            <VenueCanvas
              readOnly={!canEdit}
              tableTypes={tableTypes}
              notify={notify}
              onOpenAdd={openAdd}
              onOpenSpacing={() => setSpacingOpen(true)}
              groups={groups}
            />
          )}
          {draft.lastSavedAt ? (
            <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-slate-800/90 px-3 py-1 text-xs text-slate-300">
              {`Taslak: ${formatDraftTime(draft.lastSavedAt)}`}
            </span>
          ) : null}
        </div>
        <PropertiesPanel readOnly={!canEdit} tableTypes={tableTypes} errors={errors} />
      </div>
      <TemplateDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        eventId={eventId}
        templates={templates}
        canApply={canEdit}
        layoutLocked={lock.locked}
        canSave={canSaveTemplate}
        dirty={dirty}
        onApplied={(result) => {
          store.getState().load(toInitial(result));
          clearDraft();
        }}
        onMessage={(text) => setMessage({ kind: "ok", text })}
      />
      {addRequest ? (
        <AddElementsDialog key={addRequest.id} request={addRequest} onClose={() => setAddRequest(null)} notify={notify} />
      ) : null}
      {spacingOpen ? <SpacingDialog onClose={() => setSpacingOpen(false)} notify={notify} /> : null}
      {draft.recovery ? (
        <DraftRecoveryDialog savedAt={draft.recovery.savedAt} onRestore={draft.restore} onDiscard={draft.discard} />
      ) : null}
    </div>
  );
}
