"use client";

import type Konva from "konva";
import { useState } from "react";
import { Circle, Group, Line } from "react-konva";
import { useStore } from "zustand";
import { snap, type Point } from "../editor/geometry";
import { onActiveFloor } from "../editor/floors";
import { lineFloor, lineKey, resolveEndpoint, setEndpoint, type LineEnd } from "../editor/lines";
import type { EditorStore } from "../editor/store";
import type { DecorLine } from "../schemas";
import type { LinePreview } from "./use-line-drawing";

const SELECTED_HALO = "rgba(56,189,248,0.45)";
const HANDLE_RADIUS = 6;

/** Mağaza prop olarak gelir: Konva sahnesi içinde React bağlamına güvenilmez. */
type Props = { store: EditorStore; readOnly: boolean; preview: LinePreview };
type Override = { key: string; line: DecorLine } | null;

const points = (l: Pick<DecorLine, "x1" | "y1" | "x2" | "y2">) => [l.x1, l.y1, l.x2, l.y2];

/** Salt okunur ayırıcı çizgiler (alan planı ve şablon önizlemesi). */
export function PlanLines({ lines }: { lines: readonly DecorLine[] | undefined }) {
  return (
    <>
      {(lines ?? []).map((l) => (
        <Line key={l.id} points={points(l)} stroke={l.color} strokeWidth={l.width} lineCap="round" listening={false} />
      ))}
    </>
  );
}

/**
 * Düzenleyicideki ayırıcı çizgiler: tıklayınca seçilir (Shift ile çoklu), gövdesinden sürüklenerek taşınır,
 * tek çizgi seçiliyken uç tutamaçları sürüklenir (ızgara/Shift kuralları çizimle aynı). Bekleyen çizgi önizlemesi de burada çizilir.
 */
export function CanvasLines({ store, readOnly, preview }: Props) {
  const lines = useStore(store, (s) => s.lines);
  const selection = useStore(store, (s) => s.selection);
  const tool = useStore(store, (s) => s.tool);
  const activeFloor = useStore(store, (s) => s.activeFloor);
  const [override, setOverride] = useState<Override>(null);
  const editable = !readOnly && tool === "select";
  const selected = new Set(selection);
  const single = selection.length === 1 ? selection[0] : undefined;

  function onSelect(key: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (store.getState().tool === "line") return;
    e.cancelBubble = true;
    const multi = "shiftKey" in e.evt && (e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
    const s = store.getState();
    if (multi) s.select([key], "toggle");
    else if (!s.selection.includes(key)) s.select([key]);
  }

  function onBodyDragEnd(key: string, node: Konva.Node) {
    const s = store.getState();
    const dx = s.snapEnabled ? snap(node.x(), s.gridSize) : node.x();
    const dy = s.snapEnabled ? snap(node.y(), s.gridSize) : node.y();
    node.position({ x: 0, y: 0 });
    s.translateLineBy(key, dx, dy);
  }

  function handleMove(line: DecorLine, end: LineEnd, e: Konva.KonvaEventObject<DragEvent>) {
    const s = store.getState();
    const anchor = end === "start" ? { x: line.x2, y: line.y2 } : { x: line.x1, y: line.y1 };
    const p: Point = resolveEndpoint(e.target.position(), anchor, {
      gridSize: s.gridSize,
      snap: s.snapEnabled,
      canvas: s.canvas,
      constrain: e.evt.shiftKey,
    });
    e.target.position(p);
    setOverride({ key: lineKey(line.id), line: setEndpoint(line, end, p) });
  }

  function handleEnd(line: DecorLine, end: LineEnd, node: Konva.Node) {
    store.getState().moveLineEnd(lineKey(line.id), end, node.position());
    setOverride(null);
    // Değişiklik reddedildiyse (çok kısa) tutamaç eski yerine döner.
    const current = store.getState().lines.find((l) => l.id === line.id) ?? line;
    node.position(end === "start" ? { x: current.x1, y: current.y1 } : { x: current.x2, y: current.y2 });
  }

  return (
    <>
      {lines.map((stored) => {
        const key = lineKey(stored.id);
        const l = override?.key === key ? override.line : stored;
        const isSelected = selected.has(key);
        return (
          <Group
            key={stored.id}
            id={key}
            name="line-item"
            opacity={onActiveFloor(lineFloor(stored), activeFloor) ? 1 : 0.22}
            listening={onActiveFloor(lineFloor(stored), activeFloor)}
          >
            {isSelected ? <Line points={points(l)} stroke={SELECTED_HALO} strokeWidth={l.width + 8} lineCap="round" listening={false} /> : null}
            <Line
              points={points(l)}
              stroke={l.color}
              strokeWidth={l.width}
              hitStrokeWidth={Math.max(12, l.width + 8)}
              lineCap="round"
              draggable={editable}
              onMouseDown={(e) => onSelect(key, e)}
              onTap={(e) => onSelect(key, e)}
              onDragEnd={(e) => onBodyDragEnd(key, e.target)}
            />
            {editable && single === key
              ? (["start", "end"] as const).map((end) => (
                  <Circle
                    key={end}
                    name={`line-handle-${end}`}
                    x={end === "start" ? l.x1 : l.x2}
                    y={end === "start" ? l.y1 : l.y2}
                    radius={HANDLE_RADIUS}
                    fill="#0f172a"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    draggable
                    onMouseDown={(e) => {
                      e.cancelBubble = true;
                    }}
                    onDragMove={(e) => handleMove(stored, end, e)}
                    onDragEnd={(e) => handleEnd(stored, end, e.target)}
                  />
                ))
              : null}
          </Group>
        );
      })}
      {preview ? (
        <Line points={[preview.start.x, preview.start.y, preview.end.x, preview.end.y]} stroke="#38bdf8" strokeWidth={2} dash={[6, 4]} listening={false} />
      ) : null}
    </>
  );
}
