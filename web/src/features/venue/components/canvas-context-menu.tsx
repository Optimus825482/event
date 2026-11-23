"use client";

import { ArrowLeftRight, Box, Circle, Copy, Crown, Lock, Maximize2, Mic2, Settings, Sofa, Trash2, RectangleVertical, Unlock, Wine } from "lucide-react";
import type { ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cellCenter, cellName, type Point } from "../editor/geometry";
import { isLineKey, lineKey } from "../editor/lines";
import { decorKey, isDecorKey } from "../editor/store";
import type { DecorKind } from "../schemas";
import { runCenterHorizontally, runDelete, runTogglePin, runToggleVip, type Notify } from "./editor-commands";
import { useEditor, useEditorStore } from "./editor-context";

export type ContextTarget = { kind: "canvas"; world: Point } | { kind: "table"; key: string } | { kind: "decor"; key: string } | { kind: "line"; key: string };

type Props = {
  target: ContextTarget | null;
  disabled: boolean;
  notify: Notify;
  onOpenAdd: (kind: "table" | "loca", start: Point) => void;
  onOpenSpacing: () => void;
  children: ReactNode;
};

const DECOR_NAMES: Record<DecorKind, string> = { stage: "Sahne", area: "Alan", wall: "Duvar", label: "Metin", bar: "Bar", catwalk: "Catwalk" };

type ItemProps = { icon: ReactNode; onSelect: () => void; children: ReactNode; danger?: boolean; count?: number; testId?: string };

function Item({ icon, onSelect, children, danger, count, testId }: ItemProps) {
  return (
    <ContextMenuItem onSelect={onSelect} data-testid={testId} className={danger ? "gap-2 text-red-500 focus:text-red-500" : "gap-2"}>
      {icon}
      {children}
      {count !== undefined && count > 1 ? <ContextMenuShortcut>{`(${count})`}</ContextMenuShortcut> : null}
    </ContextMenuItem>
  );
}

function CanvasItems({ world, notify, onOpenAdd }: { world: Point; notify: Notify; onOpenAdd: Props["onOpenAdd"] }) {
  const store = useEditorStore();
  const cell = cellName(world);
  const addDecor = (kind: "stage" | "area" | "bar" | "catwalk") => {
    store.getState().addDecor(kind, cellCenter(world));
    notify("ok", `${DECOR_NAMES[kind]} eklendi: ${cell}`);
  };
  return (
    <>
      <ContextMenuLabel className="text-xs font-normal text-muted-foreground">{`Konum: ${cell}`}</ContextMenuLabel>
      <ContextMenuSeparator />
      <Item icon={<Mic2 className="size-4 text-red-500" />} onSelect={() => addDecor("stage")}>
        Sahne Ekle
      </Item>
      <Item icon={<RectangleVertical className="size-4 text-violet-500" />} onSelect={() => addDecor("catwalk")}>
        Catwalk Ekle
      </Item>
      <Item icon={<Box className="size-4 text-blue-500" />} onSelect={() => addDecor("area")}>
        Alan Ekle
      </Item>
      <Item icon={<Wine className="size-4 text-amber-500" />} onSelect={() => addDecor("bar")}>
        Bar / Hizmet Noktası Ekle
      </Item>
      <Item icon={<Circle className="size-4 text-blue-500" />} onSelect={() => onOpenAdd("table", world)}>
        Masa Ekle
      </Item>
      <Item icon={<Sofa className="size-4 text-pink-500" />} onSelect={() => onOpenAdd("loca", world)}>
        Loca Ekle
      </Item>
      <ContextMenuSeparator />
      <ContextMenuItem>İptal</ContextMenuItem>
    </>
  );
}

function DecorItems({ itemKey, notify }: { itemKey: string; notify: Notify }) {
  const store = useEditorStore();
  const element = useEditor((s) => s.elements.find((e) => decorKey(e.id) === itemKey));
  if (!element) return null;
  const pinned = element.isPinned === true;
  return (
    <>
      <ContextMenuLabel className="text-xs font-normal text-muted-foreground">{element.label || DECOR_NAMES[element.kind]}</ContextMenuLabel>
      <ContextMenuSeparator />
      <Item icon={<Maximize2 className="size-4 text-blue-400" />} onSelect={() => runCenterHorizontally(store, notify, [itemKey])}>
        Yatay Ortala
      </Item>
      <Item icon={<Settings className="size-4 text-purple-400" />} onSelect={() => store.getState().select([itemKey])}>
        Düzenle
      </Item>
      <Item
        icon={<Copy className="size-4 text-emerald-400" />}
        onSelect={() => {
          store.getState().select([itemKey]);
          store.getState().duplicateSelection();
        }}
      >
        Kopya Oluştur
      </Item>
      <Item
        icon={pinned ? <Unlock className="size-4 text-green-400" /> : <Lock className="size-4 text-amber-400" />}
        onSelect={() => runTogglePin(store, [itemKey], notify)}
      >
        {pinned ? "Kilidi Aç" : "Sabitle"}
      </Item>
      <ContextMenuSeparator />
      <Item
        danger
        icon={<Trash2 className="size-4" />}
        onSelect={() => {
          store.getState().select([itemKey]);
          runDelete(store, notify);
        }}
      >
        Sil
      </Item>
    </>
  );
}

function LineItems({ itemKey, notify }: { itemKey: string; notify: Notify }) {
  const store = useEditorStore();
  const selection = useEditor((s) => s.selection);
  const exists = useEditor((s) => s.lines.some((l) => lineKey(l.id) === itemKey));
  if (!exists) return null;
  const count = selection.filter(isLineKey).length;
  return (
    <>
      <ContextMenuLabel className="text-xs font-normal text-muted-foreground">{count > 1 ? `${count} çizgi seçili` : "Çizgi"}</ContextMenuLabel>
      <ContextMenuSeparator />
      <Item testId="line-context-duplicate" icon={<Copy className="size-4 text-emerald-400" />} onSelect={() => store.getState().duplicateSelection()} count={count}>
        Çoğalt
      </Item>
      <Item testId="line-context-delete" danger icon={<Trash2 className="size-4" />} onSelect={() => runDelete(store, notify)} count={count}>
        Sil
      </Item>
    </>
  );
}

function TableItems({ itemKey, notify, onOpenSpacing }: { itemKey: string; notify: Notify; onOpenSpacing: () => void }) {
  const store = useEditorStore();
  const selection = useEditor((s) => s.selection);
  const table = useEditor((s) => s.tables.find((t) => t.key === itemKey));
  const tables = useEditor((s) => s.tables);
  if (!table) return null;
  const keys = selection.includes(itemKey) ? selection : [itemKey];
  const wanted = new Set(keys);
  const chosen = tables.filter((t) => wanted.has(t.key));
  const tableCount = keys.filter((k) => !isDecorKey(k)).length;
  const pinned = chosen.length > 0 && chosen.every((t) => t.isPinned);
  const vip = chosen.length > 0 && chosen.every((t) => t.isVip);
  const header = tableCount > 1 ? `${tableCount} masa seçili` : table.isLoca ? `Loca: ${table.label}` : `Masa ${table.label}`;
  return (
    <>
      <ContextMenuLabel className="text-xs font-normal text-muted-foreground">{header}</ContextMenuLabel>
      <ContextMenuSeparator />
      {tableCount >= 2 ? (
        <Item icon={<ArrowLeftRight className="size-4 text-violet-400" />} onSelect={onOpenSpacing} count={tableCount}>
          Aralık Ayarla
        </Item>
      ) : null}
      <Item icon={<Copy className="size-4 text-emerald-400" />} onSelect={() => store.getState().duplicateSelection()} count={keys.length}>
        Kopya Oluştur
      </Item>
      <ContextMenuSeparator />
      <Item
        icon={pinned ? <Unlock className="size-4 text-green-400" /> : <Lock className="size-4 text-amber-400" />}
        onSelect={() => runTogglePin(store, keys, notify)}
        count={keys.length}
      >
        {pinned ? "Kilidi Aç" : "Sabitle"}
      </Item>
      <Item icon={<Crown className={vip ? "size-4 text-amber-400" : "size-4"} />} onSelect={() => runToggleVip(store, keys, notify)} count={tableCount}>
        {vip ? "VIP Kaldır" : "VIP Yap"}
      </Item>
      <Item danger icon={<Trash2 className="size-4" />} onSelect={() => runDelete(store, notify)} count={keys.length}>
        Sil
      </Item>
    </>
  );
}

/**
 * Tuvalin sağ tık menüsü: boş alanda "Konum: B3" + ekleme, sahne/alanda düzenleme, masada VIP/Sabitle/Sil.
 * Aynı işlemler araç çubuğundaki "Toplu ekle", "Hizala" ve "Seçili" menülerinden klavyeyle de yapılabilir.
 */
export function CanvasContextMenu({ target, disabled, notify, onOpenAdd, onOpenSpacing, children }: Props) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={disabled}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-[180px]">
        {target?.kind === "canvas" ? <CanvasItems world={target.world} notify={notify} onOpenAdd={onOpenAdd} /> : null}
        {target?.kind === "decor" ? <DecorItems itemKey={target.key} notify={notify} /> : null}
        {target?.kind === "line" ? <LineItems itemKey={target.key} notify={notify} /> : null}
        {target?.kind === "table" ? <TableItems itemKey={target.key} notify={notify} onOpenSpacing={onOpenSpacing} /> : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}
