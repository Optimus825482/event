"use client";

import type { KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { ColorName } from "@/lib/theme";
import { decorCenter, type PlanDecor } from "./decor";
import type { PlanModel, PlanTableModel } from "./model";
import { TABLE_STYLES, tableVisual } from "./table-style";
import { usePanZoom } from "./use-pan-zoom";

export type PlanSvgProps = {
  model: PlanModel;
  pickedIds?: ReadonlySet<string>;
  activeId?: string | null;
  dimmedIds?: ReadonlySet<string>;
  /** @deprecated Task 6 ile kaldırılır; geçici olarak activeId yerine kullanılır. */
  selectedId?: string | null;
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
  const { width, height, rotation, kind, label } = decor;
  const { x, y } = decorCenter(decor);
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotation})`} aria-hidden="true">
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={kind === "wall" ? 0 : 6}
        strokeWidth={2}
        className={DECOR_STYLE[kind]}
      />
      {label ? (
        <text textAnchor="middle" dominantBaseline="central" fontSize={kind === "label" ? 16 : 14} className="fill-ivory">
          {label}
        </text>
      ) : null}
    </g>
  );
}

/** Klavye odağı halkası: masanın çevresinde ayrı bir şekil; yalnızca odak-görünür iken çizilir. */
function FocusRing({ table }: { table: PlanTableModel }) {
  const pad = 6;
  const className = "fill-none stroke-transparent group-focus-visible:stroke-ivory";
  const common = {
    strokeWidth: 3,
    strokeDasharray: "5 3",
    vectorEffect: "non-scaling-stroke" as const,
    className,
    "data-focus-ring": "",
  };
  const { width, height } = table;
  return (
    <g transform={`rotate(${table.rotation})`} aria-hidden="true" pointerEvents="none">
      {table.shape === "round" && !table.isLoca ? (
        <circle r={width / 2 + pad} {...common} />
      ) : (
        <rect
          x={-width / 2 - pad}
          y={-height / 2 - pad}
          width={width + 2 * pad}
          height={height + 2 * pad}
          rx={8}
          {...common}
        />
      )}
    </g>
  );
}

function TableShape({ table, mark }: { table: PlanTableModel; mark: "none" | "picked" | "active" }) {
  const style = TABLE_STYLES[tableVisual(table, mark)];
  const className = cn(FILL[style.fill], STROKE[style.stroke]);
  const strokeWidth = mark === "active" ? 4 : mark === "picked" ? 3 : 2;
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

function TableNode({
  table,
  picked,
  active,
  dimmed,
  onSelect,
}: {
  table: PlanTableModel;
  picked: boolean;
  active: boolean;
  dimmed: boolean;
  onSelect?: (id: string) => void;
}) {
  const available = table.status === "available";
  const mark = active ? "active" : picked ? "picked" : "none";
  const style = TABLE_STYLES[tableVisual(table, mark)];
  const interactive = onSelect !== undefined;
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
      role={interactive ? "button" : "img"}
      data-table-id={table.id}
      data-status={table.status}
      data-dimmed={dimmed ? "true" : undefined}
      aria-label={table.ariaLabel}
      aria-pressed={interactive ? picked || active : undefined}
      aria-disabled={interactive ? !available : undefined}
      tabIndex={interactive ? (available ? 0 : -1) : undefined}
      onClick={interactive ? choose : undefined}
      onKeyDown={interactive ? onKeyDown : undefined}
      className={cn(
        "group outline-none transition-opacity",
        interactive && available ? "cursor-pointer" : "cursor-default",
        dimmed && "opacity-35",
      )}
    >
      {interactive ? <FocusRing table={table} /> : null}
      <TableShape table={table} mark={mark} />
      <text
        textAnchor="middle"
        y={secondary ? -6 : 0}
        dominantBaseline="central"
        fontSize={12}
        fontWeight={700}
        className={cn("pointer-events-none", FILL[style.text])}
      >
        {table.label}
      </text>
      {secondary ? (
        <text
          textAnchor="middle"
          y={8}
          dominantBaseline="central"
          fontSize={10}
          className={cn("pointer-events-none", FILL[style.text])}
        >
          {secondary}
        </text>
      ) : null}
    </g>
  );
}

/** 2B masa yerleşim planı: yakınlaştırma/kaydırma ve erişilebilir masa seçimi. */
export function PlanSvg({ model, pickedIds, activeId, dimmedIds, selectedId, onSelect, height = 420 }: PlanSvgProps) {
  const { ref, view, zoomIn, zoomOut, fit } = usePanZoom(model.canvas);
  const resolvedActive = activeId ?? selectedId ?? null;

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-line bg-bg">
      <div ref={ref} className="w-full touch-pan-y select-none" style={{ height }}>
        <svg role="group" aria-label="Salon planı" width="100%" height="100%" className="block">
          <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
            <rect width={model.canvas.width} height={model.canvas.height} strokeWidth={2} className="fill-surface stroke-line" />
            {model.decor.map((decor) => (
              <DecorShape key={decor.id} decor={decor} />
            ))}
            {model.lines.map((line) => (
              <line
                key={line.id}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                strokeWidth={line.width}
                aria-hidden="true"
                className="stroke-muted"
              />
            ))}
            {model.tables.map((table) => (
              <TableNode
                key={table.id}
                table={table}
                picked={pickedIds?.has(table.id) ?? false}
                active={resolvedActive === table.id}
                dimmed={dimmedIds?.has(table.id) ?? false}
                onSelect={onSelect}
              />
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
