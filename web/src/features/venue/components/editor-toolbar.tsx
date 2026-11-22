"use client";

import {
  Box,
  Copy,
  Grid3x3,
  Hand,
  Maximize2,
  Minimize2,
  LayoutTemplate,
  Magnet,
  MousePointer2,
  Plus,
  Presentation,
  RectangleHorizontal,
  Redo2,
  Save,
  Sofa,
  Square,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrangeMenu } from "./arrange-menu";
import type { Notify } from "./editor-commands";
import { useEditor, useEditorStore } from "./editor-context";

type Props = {
  readOnly: boolean;
  saving: boolean;
  show3d: boolean;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onToggle3d: () => void;
  onSave: () => void;
  onOpenTemplates: () => void;
  onBlocked: (labels: string[]) => void;
  notify: Notify;
  onOpenAdd: (kind: "table" | "loca") => void;
  onOpenSpacing: () => void;
};

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "secondary" : "ghost"}
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn("gap-1.5", active && "ring-1 ring-ring")}
    >
      {children}
    </Button>
  );
}

const Divider = () => <span className="mx-1 h-6 w-px bg-border" aria-hidden />;

export function EditorToolbar(props: Props) {
  const { readOnly, saving, show3d, fullscreen, onToggleFullscreen, onToggle3d, onSave, onOpenTemplates, onBlocked } = props;
  const store = useEditorStore();
  const tool = useEditor((s) => s.tool);
  const snapEnabled = useEditor((s) => s.snapEnabled);
  const showGrid = useEditor((s) => s.showGrid);
  const canUndo = useEditor((s) => s.history.past.length > 0);
  const canRedo = useEditor((s) => s.history.future.length > 0);
  const hasSelection = useEditor((s) => s.selection.length > 0);
  const dirty = useEditor((s) => s.dirty);
  const s = () => store.getState();

  return (
    <div className="flex flex-nowrap items-center gap-1 overflow-x-auto [&>*]:shrink-0 border-b border-border bg-background px-2 py-1.5" role="toolbar">
      <ToolButton label="Seç (sürükleyerek çoklu seçim)" active={tool === "select"} onClick={() => s().setTool("select")}>
        <MousePointer2 className="size-4" />
      </ToolButton>
      <ToolButton label="Kaydır" active={tool === "pan"} onClick={() => s().setTool("pan")}>
        <Hand className="size-4" />
      </ToolButton>
      <ToolButton label="Izgaraya hizala" active={snapEnabled} onClick={() => s().setSnap(!snapEnabled)}>
        <Magnet className="size-4" />
      </ToolButton>
      <ToolButton label="Izgarayı göster" active={showGrid} onClick={() => s().setShowGrid(!showGrid)}>
        <Grid3x3 className="size-4" />
      </ToolButton>
      {readOnly ? null : (
        <>
          <Divider />
          <ToolButton label="Masa ekle" onClick={() => s().addTable()}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">Masa</span>
          </ToolButton>
          <ToolButton label="Loca ekle" onClick={() => s().addTable({ isLoca: true, capacity: 12 })}>
            <Sofa className="size-4" />
            <span className="hidden sm:inline">Loca</span>
          </ToolButton>
          <ToolButton label="Sahne ekle" onClick={() => s().addDecor("stage")}>
            <Presentation className="size-4" />
          </ToolButton>
          <ToolButton label="Alan ekle" onClick={() => s().addDecor("area")}>
            <Square className="size-4" />
          </ToolButton>
          <ToolButton label="Duvar ekle" onClick={() => s().addDecor("wall")}>
            <RectangleHorizontal className="size-4" />
          </ToolButton>
          <ToolButton label="Metin ekle" onClick={() => s().addDecor("label")}>
            <Type className="size-4" />
          </ToolButton>
          <ArrangeMenu notify={props.notify} onOpenAdd={props.onOpenAdd} onOpenSpacing={props.onOpenSpacing} />
          <Divider />
          <ToolButton label="Geri al (Ctrl+Z)" disabled={!canUndo} onClick={() => s().undo()}>
            <Undo2 className="size-4" />
          </ToolButton>
          <ToolButton label="Yinele (Ctrl+Y)" disabled={!canRedo} onClick={() => s().redo()}>
            <Redo2 className="size-4" />
          </ToolButton>
          <ToolButton label="Çoğalt (Ctrl+D)" disabled={!hasSelection} onClick={() => s().duplicateSelection()}>
            <Copy className="size-4" />
          </ToolButton>
          <ToolButton
            label="Seçileni sil (Delete)"
            disabled={!hasSelection}
            onClick={() => {
              const { blocked } = s().deleteSelection();
              if (blocked.length > 0) onBlocked(blocked);
            }}
          >
            <Trash2 className="size-4" />
          </ToolButton>
        </>
      )}
      <Divider />
      <ToolButton label="3B önizleme" active={show3d} onClick={onToggle3d}>
        <Box className="size-4" />
        <span className="hidden sm:inline">3B</span>
      </ToolButton>
      <ToolButton label={fullscreen ? "Tam ekrandan çık" : "Tam ekran"} active={fullscreen} onClick={onToggleFullscreen}>
        {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
      </ToolButton>
      <ToolButton label="Şablonlar" onClick={onOpenTemplates}>
        <LayoutTemplate className="size-4" />
        <span className="hidden sm:inline">Şablonlar</span>
      </ToolButton>
      {readOnly ? null : (
        <Button type="button" size="sm" className="ml-auto gap-1.5" disabled={saving || !dirty} onClick={onSave}>
          <Save className="size-4" />
          {saving ? "Kaydediliyor…" : dirty ? "Kaydet" : "Kaydedildi"}
        </Button>
      )}
    </div>
  );
}
