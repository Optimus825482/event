"use client";

import type { KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { ColorName } from "@/lib/theme";
import type { PlanDecor } from "./decor";
import type { PlanModel, PlanTableModel } from "./model";
import { TABLE_STYLES, tableVisual } from "./table-style";
import { usePanZoom } from "./use-pan-zoom";

export type PlanSvgProps = {
  model: PlanModel;
  selectedId: string | null;
  onSelect?: (tableId: string) => void;
  height?: number;
};

// Tailwind sınıf adlarını kaynaktan taradığı için her sınıf düz yazı olarak bulunmalıdır.
export const FILL: Record<ColorName, string> = {
  bg: "fill-bg",
  surface: "fill-surface",
  surfaceRaised: "fill-surface-raised",
  line: "fill-line",
  gold: "fill-gold",
  goldBright: "fill-gold-bright",
  ivory: "fill-ivory",
  muted: "fill-muted",
  onGold: "fill-on-gold",
  glass: "fill-glass",
  danger: "fill-danger",
  success: "fill-success",
  disabledBg: "fill-disabled-bg",
  disabledText: "fill-disabled-text",
};
export const STROKE: Record<ColorName, string> = {
  bg: "stroke-bg",
  surface: "stroke-surface",
  surfaceRaised: "stroke-surface-raised",
  line: "stroke-line",
  gold: "stroke-gold",
  goldBright: "stroke-gold-bright",
  ivory: "stroke-ivory",
  muted: "stroke-muted",
  onGold: "stroke-on-gold",
  glass: "stroke-glass",
  danger: "stroke-danger",
  success: "stroke-success",
  disabledBg: "stroke-disabled-bg",
  disabledText: "stroke-disabled-text",
};

const DECOR_STYLE: Record<PlanDecor["kind"], string> = {
  stage: "fill-surface-raised stroke-gold",
  area: "fill-surface stroke-line [stroke-dasharray:6_4]",
  wall: "fill-line stroke-line",
  label: "fill-transparent stroke-transparent",
  bar: "fill-surface-raised stroke-line",
  catwalk: "fill-surface-raised stroke-muted",
};

function DecorShape({ decor }: { decor: PlanDecor }) {
  const { x, y, width, height, rotation, kind, label } = decor;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotation})`} aria-hidden="true">
      <rect x={-width / 2} y={-height / 2} width={width} height={height} rx={kind === "wall" ? 0 : 6} strokeWidth={2} className={DECOR_STYLE[kind]} />
      {label ? (
        <text textAnchor="middle" dominantBaseline="central" fontSize={kind === "label" ? 16 : 14} className="fill-ivory">
          {label}
        </text>
      ) : null}
    </g>
  );
}

function TableShape({ table, selected }: { table: PlanTableModel; selected: boolean }) {
  const style = TABLE_STYLES[tableVisual(table, selected)];
  const className = cn(FILL[style.fill], STROKE[style.stroke]);
  const strokeWidth = selected ? 4 : 2;
  const { width, height } = table;
  return (
    <g transform={`rotate(${table.rotation})`}>
      {table.shape === "round" && !table.isLoca ? (
        <circle r={width / 2} strokeWidth={strokeWidth} className={className} />
      ) : (
        <rect x={-width / 2} y={-height / 2} width={width} height={height} rx={4} strokeWidth={strokeWidth} className={className} />
      )}
    </g>
  );
}

function TableNode({ table, selected, onSelect }: { table: PlanTableModel; selected: boolean; onSelect?: (id: string) => void }) {
  const available = table.status === "available";
  const style = TABLE_STYLES[tableVisual(table, selected)];
  const choose = () => {
    if (available) onSelect?.(table.id);
  };
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    choose();
  };
  const secondary = table.status === "sold_out" ? "Dolu" : table.countLabel;
  return (
    <g
      transform={`translate(${table.x} ${table.y})`}
      role="button"
      data-table-id={table.id}
      data-status={table.status}
      aria-label={table.ariaLabel}
      aria-pressed={selected}
      aria-disabled={!available}
      tabIndex={available ? 0 : -1}
      onClick={choose}
      onKeyDown={onKeyDown}
      className={cn("outline-none focus-visible:outline-2 focus-visible:outline-gold", available ? "cursor-pointer" : "cursor-default")}
    >
      <TableShape table={table} selected={selected} />
      <text textAnchor="middle" y={secondary ? -6 : 0} dominantBaseline="central" fontSize={12} fontWeight={700} className={cn("pointer-events-none", FILL[style.text])}>
        {table.label}
      </text>
      {secondary ? (
        <text textAnchor="middle" y={8} dominantBaseline="central" fontSize={10} className={cn("pointer-events-none", FILL[style.text])}>
          {secondary}
        </text>
      ) : null}
    </g>
  );
}

export function PlanSvg({ model, selectedId, onSelect, height = 420 }: PlanSvgProps) {
  const { ref, view, zoomIn, zoomOut, fit } = usePanZoom(model.canvas);
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-line bg-bg">
      <div ref={ref} className="w-full touch-none select-none" style={{ height }}>
        <svg role="group" aria-label="Salon planı" width="100%" height="100%" className="block">
          <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
            <rect width={model.canvas.width} height={model.canvas.height} strokeWidth={2} className="fill-surface stroke-line" />
            {model.decor.map((decor) => (
              <DecorShape key={decor.id} decor={decor} />
            ))}
            {model.lines.map((line) => (
              <line key={line.id} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} strokeWidth={line.width} aria-hidden="true" className="stroke-muted" />
            ))}
            {model.tables.map((table) => (
              <TableNode key={table.id} table={table} selected={table.id === selectedId} onSelect={onSelect} />
            ))}
          </g>
        </svg>
      </div>
      <div className="absolute right-2 top-2 flex gap-2">
        <Button variant="glass" aria-label="Yakınlaştır" onClick={zoomIn}>
          +
        </Button>
        <Button variant="glass" aria-label="Uzaklaştır" onClick={zoomOut}>
          −
        </Button>
        <Button variant="glass" aria-label="Sığdır" onClick={fit}>
          Sığdır
        </Button>
      </div>
    </div>
  );
}
