"use client";

import { ArrowLeftRight, Crown, Grid3x3, Layers, Lock, Maximize2, Settings, Unlock, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { decorKey, isDecorKey } from "../editor/store";
import { runAutoAlign, runCenterHorizontally, runSnapToCells, runTogglePin, runToggleVip, type Notify } from "./editor-commands";
import { useEditor, useEditorStore } from "./editor-context";

type Props = {
  notify: Notify;
  onOpenAdd: (kind: "table" | "loca") => void;
  onOpenSpacing: () => void;
};

/** Toplu ekleme ve hizalama menüleri (sağ tık menüsündeki işlemlerin klavyeyle erişilebilir karşılıkları). */
export function ArrangeMenu({ notify, onOpenAdd, onOpenSpacing }: Props) {
  const store = useEditorStore();
  const selection = useEditor((s) => s.selection);
  const tableCount = useEditor((s) => s.selection.filter((k) => !isDecorKey(k)).length);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" variant="ghost" className="gap-1.5" aria-label="Toplu ekle" title="Toplu ekle">
            <Layers className="size-4" />
            <span className="hidden sm:inline">Toplu ekle</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => onOpenAdd("table")}>Masa Ekle…</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onOpenAdd("loca")}>Loca Ekle…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" variant="ghost" className="gap-1.5" aria-label="Hizala" title="Hizala">
            <Wand2 className="size-4" />
            <span className="hidden sm:inline">Hizala</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56">
          <DropdownMenuItem onSelect={() => runAutoAlign(store, notify)}>
            <Settings className="size-4" />
            {tableCount > 0 ? `Seçilileri Hizala (${tableCount})` : "Otomatik Hizala"}
          </DropdownMenuItem>
          <DropdownMenuItem title="Tüm masaları grid hücre merkezine hizala" onSelect={() => runSnapToCells(store, notify)}>
            <Grid3x3 className="size-4" />
            Merkezle
          </DropdownMenuItem>
          <DropdownMenuItem disabled={tableCount < 2} onSelect={onOpenSpacing}>
            <ArrowLeftRight className="size-4" />
            Aralık Ayarla
          </DropdownMenuItem>
          <DropdownMenuItem disabled={selection.length === 0} onSelect={() => runCenterHorizontally(store, notify)}>
            <Maximize2 className="size-4" />
            Yatay Ortala
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SelectionActions notify={notify} />
    </>
  );
}

/** "Seçili: n element" işlemleri: Sabitle / Kilidi Aç, VIP Yap / VIP Kaldır. */
function SelectionActions({ notify }: { notify: Notify }) {
  const store = useEditorStore();
  const selection = useEditor((s) => s.selection);
  const allPinned = useEditor((s) => {
    const keys = new Set(s.selection);
    const flags = [
      ...s.tables.filter((t) => keys.has(t.key)).map((t) => t.isPinned),
      ...s.elements.filter((e) => keys.has(decorKey(e.id))).map((e) => e.isPinned === true),
    ];
    return flags.length > 0 && flags.every(Boolean);
  });
  const vipState = useEditor((s) => {
    const keys = new Set(s.selection);
    const tables = s.tables.filter((t) => keys.has(t.key));
    return tables.length === 0 ? "none" : tables.every((t) => t.isVip) ? "all" : "some";
  });
  if (selection.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className="gap-1.5 text-amber-600" aria-label="Seçim işlemleri" title="Seçim işlemleri">
          {allPinned ? <Lock className="size-4" /> : <Unlock className="size-4" />}
          <span className="hidden sm:inline">{`Seçili: ${selection.length}`}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel className="text-amber-500">{`Seçili: ${selection.length} element`}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => runTogglePin(store, selection, notify)}>
          {allPinned ? <Unlock className="size-4" /> : <Lock className="size-4" />}
          {allPinned ? "Kilidi Aç" : "Sabitle"}
        </DropdownMenuItem>
        {vipState !== "none" ? (
          <DropdownMenuItem onSelect={() => runToggleVip(store, selection, notify)}>
            <Crown className="size-4" />
            {vipState === "all" ? "VIP Kaldır" : "VIP Yap"}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
