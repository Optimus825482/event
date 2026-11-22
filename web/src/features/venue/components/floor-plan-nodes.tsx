"use client";

import type Konva from "konva";
import { memo } from "react";
import { Circle, Group, Rect, Text } from "react-konva";
import { tableSize } from "../editor/geometry";
import type { PlanTable } from "../plan-types";
import { safeGroupColor } from "../editor/groups";
import { LOCA_COLOR } from "./editor-context";
import { GroupRing } from "./group-ring";

export const SELECTED_STROKE = "#facc15";
export const FOUND_STROKE = "#22d3ee";

type PlanTableNodeProps = {
  table: PlanTable;
  fill: string;
  selected: boolean;
  highlighted: boolean;
  disabled: boolean;
  interactive: boolean;
  onPick: (id: string) => void;
  onHover: (id: string | null) => void;
};

function setCursor(e: Konva.KonvaEventObject<MouseEvent>, cursor: string) {
  const container = e.target.getStage()?.container();
  if (container) container.style.cursor = cursor;
}

/** Salt okunur masa: dolgu rengi durumdan gelir; sürüklenmez, yalnızca seçilir. */
export const PlanTableNode = memo(function PlanTableNode(p: PlanTableNodeProps) {
  const { table } = p;
  const { width, height } = tableSize(table.shape, table.capacity);
  const stroke = p.selected ? SELECTED_STROKE : p.highlighted ? FOUND_STROKE : table.isLoca ? LOCA_COLOR : "#0f172a";
  const common = {
    fill: p.fill,
    stroke,
    strokeWidth: p.selected || p.highlighted ? 4 : 2,
    shadowColor: p.selected ? SELECTED_STROKE : "#000",
    shadowBlur: p.selected ? 10 : 2,
    shadowOpacity: p.selected ? 0.8 : 0.35,
  };
  const pick = () => p.onPick(table.id);
  return (
    <Group
      x={table.x}
      y={table.y}
      rotation={table.rotation}
      opacity={p.disabled ? 0.4 : 1}
      listening={p.interactive}
      onClick={pick}
      onTap={pick}
      onMouseEnter={(e) => {
        p.onHover(table.id);
        setCursor(e, p.disabled ? "not-allowed" : "pointer");
      }}
      onMouseLeave={(e) => {
        p.onHover(null);
        setCursor(e, "");
      }}
    >
      {table.group ? (
        <GroupRing width={width} height={height} round={table.shape === "round"} color={safeGroupColor(table.group.color)} />
      ) : null}
      {table.shape === "round" ? (
        <Circle radius={width / 2} {...common} />
      ) : (
        <Rect width={width} height={height} offsetX={width / 2} offsetY={height / 2} cornerRadius={6} {...common} />
      )}
      <Group rotation={-table.rotation} listening={false}>
        <Text
          text={table.label}
          width={width}
          offsetX={width / 2}
          offsetY={10}
          align="center"
          fontStyle="bold"
          fontSize={13}
          fill="#ffffff"
        />
        <Text
          text={`${table.capacity} kişi`}
          width={width}
          offsetX={width / 2}
          offsetY={-5}
          align="center"
          fontSize={10}
          fill="#f1f5f9"
        />
      </Group>
    </Group>
  );
});
