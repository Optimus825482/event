"use client";

import type Konva from "konva";
import { Minus, Plus, Scan } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layer, Line, Rect, Stage, Transformer } from "react-konva";
import { Button } from "@/components/ui/button";
import { decorFloor, layoutItems } from "../editor/collision";
import { floorKeys, onActiveFloor } from "../editor/floors";
import { clampDelta, containsPoint, normalizeRect, zoomAround, type Point, type Rect as Box } from "../editor/geometry";
import { cellName } from "../editor/view-chrome";
import { isFrozen, type EditorLock } from "../editor/lock";
import { linesInRect } from "../editor/lines";
import type { GroupBadge } from "../editor/groups";
import { decorKey, isDecorKey, shapeResolver, type Placement } from "../editor/store";
import { CanvasLines } from "./canvas-lines";
import { CanvasRulers } from "./canvas-rulers";
import { DecorNode, TableNode, type ItemHandlers } from "./canvas-items";
import { CanvasContextMenu, type ContextTarget } from "./canvas-context-menu";
import { reportMove, type Notify } from "./editor-commands";
import { useEditor, useEditorLock, useEditorStore, type TableTypeOption } from "./editor-context";
import { useLineDrawing } from "./use-line-drawing";

type Props = {
  readOnly: boolean;
  tableTypes: readonly TableTypeOption[];
  notify: Notify;
  onOpenAdd: (kind: "table" | "loca", start?: Point) => void;
  onOpenSpacing: () => void;
  /** Masa kimliği → ekip grubu (halka rengi). */
  groups?: ReadonlyMap<string, GroupBadge>;
};
type View = { scale: number; x: number; y: number };

const PADDING = 40;

function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 800, height: 600 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

function fitView(canvas: { width: number; height: number }, size: { width: number; height: number }): View {
  const scale = Math.min((size.width - PADDING * 2) / canvas.width, (size.height - PADDING * 2) / canvas.height, 1.5);
  const s = Math.max(scale, 0.2);
  return { scale: s, x: (size.width - canvas.width * s) / 2, y: (size.height - canvas.height * s) / 2 };
}

type PinSource = {
  tables: ReadonlyArray<{ key: string; id?: string | null; isPinned: boolean }>;
  elements: ReadonlyArray<{ id: string; isPinned?: boolean }>;
};

/** Sabitlenmiş ya da donmuş öğe anahtarları (sürüklenmez, dönüştürücüye bağlanmaz). */
function pinnedKeys(s: PinSource, lock: EditorLock): Set<string> {
  return new Set([
    ...s.tables.filter((t) => t.isPinned || (t.id != null && isFrozen(lock, t.id))).map((t) => t.key),
    ...s.elements.filter((e) => e.isPinned === true).map((e) => decorKey(e.id)),
  ]);
}

export default function VenueCanvas({ readOnly, tableTypes, notify, onOpenAdd, onOpenSpacing, groups }: Props) {
  const store = useEditorStore();
  const lock = useEditorLock();
  const containerRef = useRef<HTMLDivElement>(null);
  const size = useContainerSize(containerRef);
  const tables = useEditor((s) => s.tables);
  const elements = useEditor((s) => s.elements);
  const canvas = useEditor((s) => s.canvas);
  const selection = useEditor((s) => s.selection);
  const tool = useEditor((s) => s.tool);
  const activeFloor = useEditor((s) => s.activeFloor);
  const gridSize = useEditor((s) => s.gridSize);
  const showGrid = useEditor((s) => s.showGrid);
  const [pointerCell, setPointerCell] = useState<string | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [lasso, setLasso] = useState<{ start: Point; end: Point; additive: boolean } | null>(null);
  const nodes = useRef(new Map<string, Konva.Node>());
  const dragStart = useRef(new Map<string, Point>());
  const dragBoxes = useRef<Box[]>([]);
  const [menuTarget, setMenuTarget] = useState<ContextTarget | null>(null);
  const transformer = useRef<Konva.Transformer>(null);
  const typeById = useMemo(() => new Map(tableTypes.map((t) => [t.id, t])), [tableTypes]);
  const selected = useMemo(() => new Set(selection), [selection]);
  const current = view ?? fitView(canvas, size);
  const canDrag = !readOnly && tool === "select";
  const drawing = useLineDrawing(store);

  useEffect(() => {
    const tr = transformer.current;
    if (!tr) return;
    const pinned = pinnedKeys({ tables, elements }, lock);
    const attached = selection
      .filter((k) => !pinned.has(k))
      .map((k) => nodes.current.get(k))
      .filter((n): n is Konva.Node => n !== undefined);
    tr.nodes(readOnly ? [] : attached);
    tr.resizeEnabled(selection.length > 0 && selection.every(isDecorKey));
    tr.getLayer()?.batchDraw();
  }, [selection, tables, elements, readOnly, lock]);

  /**
   * Izgaraya oturtma sonucu store değeri sürükleme öncesiyle aynı kalırsa React prop'u değişmez ve
   * Konva düğümü bırakıldığı yerde kalır; düğümler store'daki değere elle eşitlenir.
   */
  const syncNodes = useCallback(
    (keys: readonly string[]) => {
      const s = store.getState();
      const byKey = new Map<string, { x: number; y: number; rotation: number }>([
        ...s.tables.map((t) => [t.key, t] as const),
        ...s.elements.map((e) => [decorKey(e.id), e] as const),
      ]);
      for (const key of keys) {
        const target = byKey.get(key);
        const node = nodes.current.get(key);
        if (target && node) node.setAttrs({ x: target.x, y: target.y, rotation: target.rotation });
      }
    },
    [store],
  );

  const handlers: ItemHandlers = useMemo(
    () => ({
      draggable: !readOnly && tool === "select",
      register: (key, node) => {
        if (node) nodes.current.set(key, node);
        else nodes.current.delete(key);
      },
      onSelect: (key, e) => {
        if (store.getState().tool === "line") return; // çizgi aracında tıklama sahneye geçer
        e.cancelBubble = true;
        const evt = e.evt;
        const multi = "shiftKey" in evt && (evt.shiftKey || evt.ctrlKey || evt.metaKey);
        const s = store.getState();
        if (multi) s.select([key], "toggle");
        else if (!s.selection.includes(key)) s.select([key]);
      },
      onDragStart: (key) => {
        const s = store.getState();
        const pinned = pinnedKeys(s, lock);
        const moving = (s.selection.includes(key) ? s.selection : [key]).filter((k) => !pinned.has(k));
        if (!s.selection.includes(key)) s.select([key]);
        const movingSet = new Set(moving);
        dragBoxes.current = layoutItems(s.tables, s.elements, shapeResolver(s))
          .filter((i) => movingSet.has(i.key))
          .map((i) => i.box);
        dragStart.current = new Map(
          moving.flatMap((k) => {
            const n = nodes.current.get(k);
            return n ? [[k, { x: n.x(), y: n.y() }] as const] : [];
          }),
        );
      },
      onDragMove: (key, node) => {
        const origin = dragStart.current.get(key);
        if (!origin) return;
        // Grup tuvalin dışına sürüklenemez.
        const d = clampDelta(dragBoxes.current, { x: node.x() - origin.x, y: node.y() - origin.y }, store.getState().canvas);
        for (const [k, start] of dragStart.current) {
          const target = k === key ? node : nodes.current.get(k);
          target?.position({ x: start.x + d.x, y: start.y + d.y });
        }
      },
      onDragEnd: () => {
        const placements: Placement[] = [];
        for (const k of dragStart.current.keys()) {
          const n = nodes.current.get(k);
          if (n) placements.push({ key: k, x: n.x(), y: n.y() });
        }
        dragStart.current = new Map();
        dragBoxes.current = [];
        // Çakışma varsa store değişmez ve düğümler eski yerine döner.
        reportMove(store.getState().commitPlacements(placements), notify);
        syncNodes(placements.map((p) => p.key));
      },
    }),
    [readOnly, tool, store, syncNodes, notify, lock],
  );

  const onTransformEnd = useCallback(() => {
    const placements: Placement[] = [];
    const elementsByKey = new Map(store.getState().elements.map((e) => [decorKey(e.id), e]));
    for (const key of store.getState().selection) {
      const n = nodes.current.get(key);
      if (!n) continue;
      const element = elementsByKey.get(key);
      placements.push({
        key,
        x: n.x(),
        y: n.y(),
        rotation: n.rotation(),
        ...(element ? { width: element.width * n.scaleX(), height: element.height * n.scaleY() } : {}),
      });
      n.scale({ x: 1, y: 1 });
    }
    reportMove(store.getState().commitPlacements(placements), notify);
    syncNodes(placements.map((p) => p.key));
  }, [store, syncNodes, notify]);

  /** Sağ tık hedefi: Konva olayı Radix menüsünden önce gelir, menü bu hedefe göre çizilir. */
  function onContextMenu(e: Konva.KonvaEventObject<PointerEvent>) {
    const stage = e.target.getStage();
    if (!stage || readOnly) return;
    if (e.target === stage || e.target.name() === "background") {
      const world = stage.getRelativePointerPosition();
      setMenuTarget(world ? { kind: "canvas", world } : null);
      return;
    }
    const lineItem = e.target.findAncestor(".line-item", true);
    if (lineItem) {
      const lineId = lineItem.id();
      const s = store.getState();
      if (!s.selection.includes(lineId)) s.select([lineId]);
      setMenuTarget({ kind: "line", key: lineId });
      return;
    }
    const item = e.target.findAncestor(".item", true);
    const key = [...nodes.current.entries()].find(([, n]) => n === item)?.[0];
    if (!key) {
      setMenuTarget(null);
      return;
    }
    const s = store.getState();
    if (!s.selection.includes(key)) s.select([key]);
    setMenuTarget({ kind: isDecorKey(key) ? "decor" : "table", key });
  }

  function worldPointer(stage: Konva.Stage): Point | null {
    return stage.getRelativePointerPosition();
  }

  function onStageDown(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const stage = e.target.getStage();
    if (!stage || readOnly || drawing.onStageDown(e) || tool !== "select") return;
    if (e.target !== stage && e.target.name() !== "background") return;
    // Sağ tık seçim çerçevesi başlatmaz (sağ tık menüsü açılır).
    if ("button" in e.evt && e.evt.button !== 0) return;
    const p = worldPointer(stage);
    if (!p) return;
    const additive = "shiftKey" in e.evt && e.evt.shiftKey;
    setLasso({ start: p, end: p, additive });
  }

  function onStageMove(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const stage = e.target.getStage();
    const p = stage ? worldPointer(stage) : null;
    if (!p) return;
    const inside = p.x <= canvas.width && p.y <= canvas.height;
    setPointerCell(inside ? cellName(p, gridSize * 2) : null);
    if (lasso) setLasso({ ...lasso, end: p });
    drawing.onStageMove(e);
  }

  function onStageUp() {
    if (!lasso) return;
    const rect = normalizeRect(lasso.start, lasso.end);
    setLasso(null);
    const s = store.getState();
    if (rect.width < 3 && rect.height < 3) {
      if (!lasso.additive) s.clearSelection();
      return;
    }
    const active = floorKeys(s, s.activeFloor);
    const hits = [
      ...s.tables.filter((t) => containsPoint(rect, t)).map((t) => t.key),
      ...s.elements
        .filter((el) => containsPoint(rect, { x: el.x + el.width / 2, y: el.y + el.height / 2 }))
        .map((el) => decorKey(el.id)),
      ...linesInRect(s.lines, rect),
    ].filter((k) => active.has(k));
    s.select(hits, lasso.additive ? "add" : "replace");
  }

  function onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    const factor = e.evt.deltaY > 0 ? 1 / 1.1 : 1.1;
    setView(zoomAround(current, pointer, current.scale * factor));
  }

  function zoomBy(factor: number) {
    setView(zoomAround(current, { x: size.width / 2, y: size.height / 2 }, current.scale * factor));
  }

  const gridLines = useMemo(() => {
    const step = gridSize * 2;
    const lines: Array<{ key: string; points: number[] }> = [];
    for (let x = step; x < canvas.width; x += step) lines.push({ key: `v${x}`, points: [x, 0, x, canvas.height] });
    for (let y = step; y < canvas.height; y += step) lines.push({ key: `h${y}`, points: [0, y, canvas.width, y] });
    return lines;
  }, [canvas.width, canvas.height, gridSize]);

  const lassoRect = lasso ? normalizeRect(lasso.start, lasso.end) : null;

  return (
    <CanvasContextMenu target={menuTarget} disabled={readOnly} notify={notify} onOpenAdd={onOpenAdd} onOpenSpacing={onOpenSpacing}>
      <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-slate-950" data-testid="venue-canvas">
        <Stage
          width={size.width}
          height={size.height}
          scaleX={current.scale}
          scaleY={current.scale}
          x={current.x}
          y={current.y}
          draggable={tool === "pan"}
          onDragEnd={(e) => {
            if (e.target === e.target.getStage()) setView({ ...current, x: e.target.x(), y: e.target.y() });
          }}
          onMouseDown={onStageDown}
          onTouchStart={onStageDown}
          onMouseMove={onStageMove}
          onTouchMove={onStageMove}
          onMouseUp={onStageUp}
          onTouchEnd={onStageUp}
          onWheel={onWheel}
          onMouseLeave={() => setPointerCell(null)}
          onContextMenu={onContextMenu}
          style={{ cursor: tool === "pan" ? "grab" : tool === "line" ? "crosshair" : "default" }}
        >
          <Layer>
            <Rect name="background" width={canvas.width} height={canvas.height} fill="#1e293b" stroke="#475569" />
            {(showGrid ? gridLines : []).map((l) => (
              <Line key={l.key} points={l.points} stroke="#334155" strokeWidth={1} listening={false} />
            ))}
          </Layer>
          <Layer>
            {elements.map((el) => (
              <DecorNode
                key={el.id}
                element={el}
                itemKey={decorKey(el.id)}
                selected={selected.has(decorKey(el.id))}
                muted={!onActiveFloor(decorFloor(el), activeFloor)}
                {...handlers}
                draggable={canDrag && el.isPinned !== true}
              />
            ))}
            <CanvasLines store={store} readOnly={readOnly} preview={drawing.preview} />
            {tables.map((t) => (
              <TableNode
                key={t.key}
                table={t}
                type={t.tableTypeId ? typeById.get(t.tableTypeId) : undefined}
                selected={selected.has(t.key)}
                muted={!onActiveFloor(t.floor, activeFloor)}
                groupColor={t.id ? groups?.get(t.id)?.color : undefined}
                {...handlers}
                draggable={canDrag && !t.isPinned && !(t.id !== null && isFrozen(lock, t.id))}
                frozen={t.id !== null && isFrozen(lock, t.id)}
              />
            ))}
            <Transformer
              ref={transformer}
              rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
              keepRatio={false}
              onTransformEnd={onTransformEnd}
            />
            {lassoRect ? (
              <Rect {...lassoRect} fill="rgba(56,189,248,0.15)" stroke="#38bdf8" dash={[4, 4]} listening={false} />
            ) : null}
          </Layer>
        </Stage>
        <CanvasRulers canvas={canvas} cellSize={gridSize * 2} view={current} size={size} position={pointerCell} />
        <div className="absolute bottom-3 right-3 flex gap-1 rounded-md bg-background/90 p-1 shadow">
          <Button size="icon" variant="ghost" aria-label="Uzaklaştır" onClick={() => zoomBy(1 / 1.2)}>
            <Minus className="size-4" />
          </Button>
          <span className="w-12 self-center text-center text-xs tabular-nums">{Math.round(current.scale * 100)}%</span>
          <Button size="icon" variant="ghost" aria-label="Yakınlaştır" onClick={() => zoomBy(1.2)}>
            <Plus className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Sığdır" onClick={() => setView(null)}>
            <Scan className="size-4" />
          </Button>
        </div>
      </div>
    </CanvasContextMenu>
  );
}
