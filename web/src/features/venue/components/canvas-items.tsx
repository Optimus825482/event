"use client";

import type Konva from "konva";
import { memo } from "react";
import { Circle, Group, Rect, Text } from "react-konva";
import { tableSize } from "../editor/geometry";
import type { EditorTable } from "../editor/store";
import type { DecorElement } from "../schemas";
import { DEFAULT_TABLE_COLOR, LOCA_COLOR, tableShapeOf, type TableTypeOption } from "./editor-context";

const SELECTED_STROKE = "#facc15";

export type ItemHandlers = {
  draggable: boolean;
  register: (key: string, node: Konva.Node | null) => void;
  onSelect: (key: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart: (key: string) => void;
  onDragMove: (key: string, node: Konva.Node) => void;
  onDragEnd: () => void;
};

type TableNodeProps = ItemHandlers & { table: EditorTable; type: TableTypeOption | undefined; selected: boolean };

export const TableNode = memo(function TableNode({ table, type, selected, ...h }: TableNodeProps) {
  const shape = tableShapeOf(type);
  const { width, height } = tableSize(shape, table.capacity);
  const fill = table.isLoca ? LOCA_COLOR : (type?.color ?? DEFAULT_TABLE_COLOR);
  const stroke = selected ? SELECTED_STROKE : table.locked ? "#f8fafc" : "#0f172a";
  const common = {
    fill,
    stroke,
    strokeWidth: selected ? 3 : 1.5,
    dash: table.locked && !selected ? [4, 3] : undefined,
    shadowColor: "#000",
    shadowBlur: selected ? 8 : 2,
    shadowOpacity: 0.35,
  };
  return (
    <Group
      ref={(node) => h.register(table.key, node)}
      name="item"
      x={table.x}
      y={table.y}
      rotation={table.rotation}
      draggable={h.draggable}
      onMouseDown={(e) => h.onSelect(table.key, e)}
      onTap={(e) => h.onSelect(table.key, e)}
      onDragStart={() => h.onDragStart(table.key)}
      onDragMove={(e) => h.onDragMove(table.key, e.target)}
      onDragEnd={h.onDragEnd}
    >
      {shape === "round" ? (
        <Circle radius={width / 2} {...common} />
      ) : (
        <Rect width={width} height={height} offsetX={width / 2} offsetY={height / 2} cornerRadius={6} {...common} />
      )}
      <Text
        text={table.label}
        width={width}
        offsetX={width / 2}
        offsetY={10}
        align="center"
        fontStyle="bold"
        fontSize={13}
        fill="#ffffff"
        listening={false}
      />
      <Text
        text={`${table.capacity} kişi`}
        width={width}
        offsetX={width / 2}
        offsetY={-5}
        align="center"
        fontSize={10}
        fill="#e2e8f0"
        listening={false}
      />
    </Group>
  );
});

type DecorNodeProps = ItemHandlers & { element: DecorElement; itemKey: string; selected: boolean };

export const DecorNode = memo(function DecorNode({ element, itemKey, selected, ...h }: DecorNodeProps) {
  const color = element.color ?? "#64748b";
  const isText = element.kind === "label";
  return (
    <Group
      ref={(node) => h.register(itemKey, node)}
      name="item"
      x={element.x}
      y={element.y}
      rotation={element.rotation}
      draggable={h.draggable}
      onMouseDown={(e) => h.onSelect(itemKey, e)}
      onTap={(e) => h.onSelect(itemKey, e)}
      onDragStart={() => h.onDragStart(itemKey)}
      onDragMove={(e) => h.onDragMove(itemKey, e.target)}
      onDragEnd={h.onDragEnd}
    >
      <Rect
        width={element.width}
        height={element.height}
        fill={isText ? "transparent" : color}
        opacity={element.kind === "area" ? 0.3 : element.kind === "stage" ? 0.75 : 1}
        stroke={selected ? SELECTED_STROKE : isText ? undefined : color}
        strokeWidth={selected ? 2 : 1}
        dash={isText && selected ? [4, 3] : undefined}
        cornerRadius={element.kind === "wall" ? 0 : 4}
      />
      {element.label ? (
        <Text
          text={element.label}
          width={element.width}
          height={element.height}
          align="center"
          verticalAlign="middle"
          fontSize={isText ? 18 : 16}
          fontStyle="bold"
          fill={isText ? color : "#ffffff"}
          listening={false}
        />
      ) : null}
    </Group>
  );
});
