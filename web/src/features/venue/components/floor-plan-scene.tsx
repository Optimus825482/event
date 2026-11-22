"use client";

import type Konva from "konva";
import { Minus, Plus, Scan, Search, SquareDashedMousePointer } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layer, Rect, Shape, Stage } from "react-konva";
import { Button } from "@/components/ui/button";
import { zoomAround, type Point } from "../editor/geometry";
import { distinctGroups, safeGroupColor } from "../editor/groups";
import { PLAN_STATUS_COLORS, PLAN_STATUS_LABELS, PLAN_STATUS_ORDER, planTableFill } from "../plan-status";
import {
  centerOn,
  fitView,
  isLassoDrag,
  isZoomAtLimit,
  rectFromPoints,
  searchTables,
  tablesInRect,
  toWorld,
  zoomBy,
  type Size,
  type View,
} from "../plan-view-math";
import { DecorNode, type ItemHandlers } from "./canvas-items";
import { DEFAULT_TABLE_COLOR, LOCA_COLOR } from "./editor-context";
import { PlanTableNode, SELECTED_STROKE } from "./floor-plan-nodes";
import type { FloorPlanViewProps } from "./floor-plan-view";

const GRID = 40;
const WHEEL_STEP = 1.1;
const NO_IDS: readonly string[] = [];

/** Dekor öğeleri salt okunur: tutamaçlar boş, sürükleme kapalı. */
const READ_ONLY_HANDLERS: ItemHandlers = {
  draggable: false,
  register: () => undefined,
  onSelect: () => undefined,
  onDragStart: () => undefined,
  onDragMove: () => undefined,
  onDragEnd: () => undefined,
};

function useContainerSize(ref: React.RefObject<HTMLDivElement | null>, height: number): Size {
  const [size, setSize] = useState<Size>({ width: 0, height });
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

function drawGrid(canvas: Size) {
  return (ctx: Konva.Context, shape: Konva.Shape) => {
    ctx.beginPath();
    for (let x = GRID; x < canvas.width; x += GRID) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
    }
    for (let y = GRID; y < canvas.height; y += GRID) {
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
    }
    ctx.strokeShape(shape);
  };
}

function GroupLegend({ groups }: { groups: ReadonlyArray<{ name: string; color: string }> }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300" aria-label="Grup açıklaması">
      {groups.map((g) => (
        <li key={`${g.name}|${g.color}`} className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-3 rounded-full border-2" style={{ borderColor: safeGroupColor(g.color) }} />
          {g.name}
        </li>
      ))}
    </ul>
  );
}

function Legend({ showSelected }: { showSelected: boolean }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300" aria-label="Renk açıklaması">
      {PLAN_STATUS_ORDER.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-3 rounded-full" style={{ backgroundColor: PLAN_STATUS_COLORS[s] }} />
          {PLAN_STATUS_LABELS[s]}
        </li>
      ))}
      {showSelected ? (
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-3 rounded-full border-2" style={{ borderColor: SELECTED_STROKE }} />
          Seçili
        </li>
      ) : null}
    </ul>
  );
}

export default function FloorPlanScene(props: FloorPlanViewProps) {
  const { plan, statuses, selectedId = null, onSelect, colorByTable, onSelectMany } = props;
  const compact = props.compact === true;
  const interactive = !compact;
  const height = props.height ?? (compact ? 220 : 420);
  const disabledIds = props.disabledIds ?? NO_IDS;
  const containerRef = useRef<HTMLDivElement>(null);
  const size = useContainerSize(containerRef, height);
  const [view, setView] = useState<View | null>(null);
  const [query, setQuery] = useState("");
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [lassoMode, setLassoMode] = useState(false);
  /** Kement köşeleri ekran koordinatında (sahne kapsayıcısına göre). */
  const [lasso, setLasso] = useState<{ start: Point; end: Point } | null>(null);
  const suppressClick = useRef(false);
  const lassoOn = interactive && onSelectMany !== undefined && lassoMode;

  const current = view ?? fitView(plan.canvas, size);
  const disabled = useMemo(() => new Set(disabledIds), [disabledIds]);
  const outlinedIds = props.outlinedIds ?? NO_IDS;
  const outlined = useMemo(() => new Set(outlinedIds), [outlinedIds]);
  const matches = useMemo(() => searchTables(plan.tables, query), [plan.tables, query]);
  const matchIds = useMemo(() => new Set(matches.map((t) => t.id)), [matches]);
  const hovered = hoverId ? plan.tables.find((t) => t.id === hoverId) : undefined;
  const limits = isZoomAtLimit(current);
  const groups = useMemo(
    () => distinctGroups(plan.tables.flatMap((t) => (t.group ? [t.group] : []))),
    [plan.tables],
  );

  const pick = useCallback(
    (id: string) => {
      // Kement bırakılırken altında kalan masaya düşen tıklama seçimi bozmasın.
      if (suppressClick.current) return;
      if (disabled.has(id)) return;
      onSelect?.(id);
    },
    [disabled, onSelect],
  );

  function locate() {
    const first = matches[0];
    if (first) setView(centerOn({ x: first.x, y: first.y }, size, current, 1));
  }

  function onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const pointer = e.target.getStage()?.getPointerPosition();
    if (!pointer) return;
    setView(zoomAround(current, pointer, current.scale * (e.evt.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP)));
  }

  function pointerOf(e: Konva.KonvaEventObject<PointerEvent>): Point | null {
    return e.target.getStage()?.getPointerPosition() ?? null;
  }

  function onPointerDown(e: Konva.KonvaEventObject<PointerEvent>) {
    if (!lassoOn) return;
    const p = pointerOf(e);
    if (p) setLasso({ start: p, end: p });
  }

  function onPointerMove(e: Konva.KonvaEventObject<PointerEvent>) {
    if (!lasso) return;
    const p = pointerOf(e);
    if (p) setLasso({ start: lasso.start, end: p });
  }

  function finishLasso() {
    if (!lasso) return;
    setLasso(null);
    if (!isLassoDrag(lasso.start, lasso.end)) return;
    suppressClick.current = true;
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const rect = rectFromPoints(toWorld(lasso.start, current), toWorld(lasso.end, current));
    const ids = tablesInRect(plan.tables, rect).filter((id) => !disabled.has(id));
    if (ids.length > 0) onSelectMany?.(ids);
  }

  const lassoRect = lasso ? rectFromPoints(toWorld(lasso.start, current), toWorld(lasso.end, current)) : null;

  function onDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    if (e.target !== e.target.getStage()) return;
    setView({ scale: current.scale, x: e.target.x(), y: e.target.y() });
  }

  const caption = hovered
    ? [
        hovered.label,
        `${hovered.capacity} kişilik`,
        statuses && !colorByTable ? PLAN_STATUS_LABELS[statuses[hovered.id] ?? "free"] : null,
        hovered.group ? `Grup: ${hovered.group.name}` : null,
        disabled.has(hovered.id) ? "seçilemez" : null,
      ]
        .filter((part): part is string => part !== null)
        .join(" · ")
    : "";

  return (
    <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-100">
      {interactive ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  locate();
                }
              }}
              placeholder="Masa ara"
              aria-label="Planda masa ara"
              className="h-8 w-36 rounded-md border border-slate-600 bg-slate-900 pl-8 pr-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
          </div>
          <Button type="button" size="sm" variant="outline" onClick={locate} disabled={matches.length === 0}>
            Bul
          </Button>
          {query.trim() ? (
            <span role="status" className="text-xs text-slate-400">
              {matches.length === 0 ? "Eşleşme yok" : `${matches.length} masa`}
            </span>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            {onSelectMany ? (
              <Button
                type="button"
                size="sm"
                variant={lassoMode ? "default" : "outline"}
                aria-pressed={lassoMode}
                title="Açıkken planda sürükleyerek dikdörtgen içindeki masaları seçin"
                onClick={() => setLassoMode((v) => !v)}
              >
                <SquareDashedMousePointer aria-hidden className="size-4" />
                Alan seç
              </Button>
            ) : null}
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Uzaklaştır"
              disabled={limits.min}
              onClick={() => setView(zoomBy(current, size, 1 / WHEEL_STEP))}
            >
              <Minus aria-hidden className="size-4" />
            </Button>
            <span className="w-12 text-center text-xs text-slate-400" aria-live="polite">
              %{Math.round(current.scale * 100)}
            </span>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Yakınlaştır"
              disabled={limits.max}
              onClick={() => setView(zoomBy(current, size, WHEEL_STEP))}
            >
              <Plus aria-hidden className="size-4" />
            </Button>
            <Button type="button" size="icon" variant="outline" aria-label="Ekrana sığdır" onClick={() => setView(null)}>
              <Scan aria-hidden className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <div
        ref={containerRef}
        role="img"
        aria-label={props.ariaLabel ?? "Yerleşim planı"}
        className="overflow-hidden rounded-md bg-slate-950"
        style={{ height }}
      >
        {size.width > 0 ? (
          <Stage
            width={size.width}
            height={size.height}
            x={current.x}
            y={current.y}
            scaleX={current.scale}
            scaleY={current.scale}
            draggable={interactive && !lassoOn}
            onWheel={interactive ? onWheel : undefined}
            onDragEnd={interactive ? onDragEnd : undefined}
            onPointerDown={lassoOn ? onPointerDown : undefined}
            onPointerMove={lassoOn ? onPointerMove : undefined}
            onPointerUp={lassoOn ? finishLasso : undefined}
            onPointerLeave={lassoOn ? finishLasso : undefined}
          >
            <Layer listening={false}>
              <Rect width={plan.canvas.width} height={plan.canvas.height} fill="#0f172a" stroke="#334155" strokeWidth={2} />
              <Shape sceneFunc={drawGrid(plan.canvas)} stroke="#1e293b" strokeWidth={1} />
            </Layer>
            <Layer listening={false}>
              {plan.decor.map((element) => (
                <DecorNode
                  key={element.id}
                  element={element}
                  itemKey={`decor:${element.id}`}
                  selected={false}
                  {...READ_ONLY_HANDLERS}
                />
              ))}
            </Layer>
            <Layer>
              {plan.tables.map((table) => (
                <PlanTableNode
                  key={table.id}
                  table={table}
                  fill={planTableFill(
                    table.id,
                    table.isLoca ? LOCA_COLOR : (table.color ?? DEFAULT_TABLE_COLOR),
                    statuses,
                    colorByTable,
                  )}
                  selected={table.id === selectedId}
                  highlighted={matchIds.has(table.id)}
                  outlined={outlined.has(table.id)}
                  disabled={disabled.has(table.id)}
                  interactive={interactive}
                  onPick={pick}
                  onHover={setHoverId}
                />
              ))}
            </Layer>
            {lassoRect ? (
              <Layer listening={false}>
                <Rect
                  {...lassoRect}
                  fill="rgba(59,130,246,0.15)"
                  stroke="#60a5fa"
                  strokeWidth={1 / current.scale}
                  dash={[6 / current.scale, 4 / current.scale]}
                />
              </Layer>
            ) : null}
          </Stage>
        ) : null}
      </div>

      {interactive ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            {statuses && !colorByTable ? <Legend showSelected={onSelect !== undefined} /> : null}
            {groups.length > 0 ? <GroupLegend groups={groups} /> : null}
          </div>
          <p className="min-h-4 text-xs text-slate-300" aria-live="polite">
            {caption}
          </p>
        </div>
      ) : null}
    </div>
  );
}
