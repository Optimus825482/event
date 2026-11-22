"use client";

import type Konva from "konva";
import { Minus, Plus, Scan } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layer, Line, Rect, Stage, Transformer } from "react-konva";
import { Button } from "@/components/ui/button";
import { containsPoint, normalizeRect, zoomAround, type Point } from "../editor/geometry";
import { decorKey, isDecorKey, type Placement } from "../editor/store";
import { DecorNode, TableNode, type ItemHandlers } from "./canvas-items";
import { useEditor, useEditorStore, type TableTypeOption } from "./editor-context";

type Props = { readOnly: boolean; tableTypes: readonly TableTypeOption[] };
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

export default function VenueCanvas({ readOnly, tableTypes }: Props) {
  const store = useEditorStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const size = useContainerSize(containerRef);
  const tables = useEditor((s) => s.tables);
  const elements = useEditor((s) => s.elements);
  const canvas = useEditor((s) => s.canvas);
  const selection = useEditor((s) => s.selection);
  const tool = useEditor((s) => s.tool);
  const gridSize = useEditor((s) => s.gridSize);
  const [view, setView] = useState<View | null>(null);
  const [lasso, setLasso] = useState<{ start: Point; end: Point; additive: boolean } | null>(null);
  const nodes = useRef(new Map<string, Konva.Node>());
  const dragStart = useRef(new Map<string, Point>());
  const transformer = useRef<Konva.Transformer>(null);
  const typeById = useMemo(() => new Map(tableTypes.map((t) => [t.id, t])), [tableTypes]);
  const selected = useMemo(() => new Set(selection), [selection]);
  const current = view ?? fitView(canvas, size);

  useEffect(() => {
    const tr = transformer.current;
    if (!tr) return;
    const attached = selection.map((k) => nodes.current.get(k)).filter((n): n is Konva.Node => n !== undefined);
    tr.nodes(readOnly ? [] : attached);
    tr.resizeEnabled(selection.length > 0 && selection.every(isDecorKey));
    tr.getLayer()?.batchDraw();
  }, [selection, tables, elements, readOnly]);

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
        e.cancelBubble = true;
        const evt = e.evt;
        const multi = "shiftKey" in evt && (evt.shiftKey || evt.ctrlKey || evt.metaKey);
        const s = store.getState();
        if (multi) s.select([key], "toggle");
        else if (!s.selection.includes(key)) s.select([key]);
      },
      onDragStart: (key) => {
        const s = store.getState();
        const moving = s.selection.includes(key) ? s.selection : [key];
        if (!s.selection.includes(key)) s.select([key]);
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
        const dx = node.x() - origin.x;
        const dy = node.y() - origin.y;
        for (const [k, start] of dragStart.current) {
          if (k !== key) nodes.current.get(k)?.position({ x: start.x + dx, y: start.y + dy });
        }
      },
      onDragEnd: () => {
        const placements: Placement[] = [];
        for (const k of dragStart.current.keys()) {
          const n = nodes.current.get(k);
          if (n) placements.push({ key: k, x: n.x(), y: n.y() });
        }
        dragStart.current = new Map();
        store.getState().commitPlacements(placements);
        syncNodes(placements.map((p) => p.key));
      },
    }),
    [readOnly, tool, store, syncNodes],
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
    store.getState().commitPlacements(placements);
    syncNodes(placements.map((p) => p.key));
  }, [store, syncNodes]);

  function worldPointer(stage: Konva.Stage): Point | null {
    return stage.getRelativePointerPosition();
  }

  function onStageDown(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const stage = e.target.getStage();
    if (!stage || tool !== "select" || readOnly) return;
    if (e.target !== stage && e.target.name() !== "background") return;
    const p = worldPointer(stage);
    if (!p) return;
    const additive = "shiftKey" in e.evt && e.evt.shiftKey;
    setLasso({ start: p, end: p, additive });
  }

  function onStageMove(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (!lasso) return;
    const stage = e.target.getStage();
    const p = stage ? worldPointer(stage) : null;
    if (p) setLasso({ ...lasso, end: p });
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
    const hits = [
      ...s.tables.filter((t) => containsPoint(rect, t)).map((t) => t.key),
      ...s.elements
        .filter((el) => containsPoint(rect, { x: el.x + el.width / 2, y: el.y + el.height / 2 }))
        .map((el) => decorKey(el.id)),
    ];
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
        style={{ cursor: tool === "pan" ? "grab" : "default" }}
      >
        <Layer>
          <Rect name="background" width={canvas.width} height={canvas.height} fill="#1e293b" stroke="#475569" />
          {gridLines.map((l) => (
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
              {...handlers}
            />
          ))}
          {tables.map((t) => (
            <TableNode
              key={t.key}
              table={t}
              type={t.tableTypeId ? typeById.get(t.tableTypeId) : undefined}
              selected={selected.has(t.key)}
              {...handlers}
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
  );
}
