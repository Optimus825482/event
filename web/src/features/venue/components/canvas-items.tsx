"use client";

import type Konva from "konva";
import { memo } from "react";
import { Circle, Group, Path, Rect, Text } from "react-konva";
import { effectiveTableSize } from "../editor/geometry";
import type { EditorTable } from "../editor/store";
import type { DecorElement } from "../schemas";
import { GroupRing } from "./group-ring";
import { ICON_PATHS, resolveDecorStyle } from "./decor-style";
import { LOCA_COLOR, tableShapeOf, type TableTypeOption } from "./editor-context";
import { LocaBooth, TableBadges } from "./table-shapes";
import { capacityColor, tableDims, VIP_BORDER, VIP_FILL } from "./table-visual";

const SELECTED_STROKE = "#facc15";

export type ItemHandlers = {
  draggable: boolean;
  register: (key: string, node: Konva.Node | null) => void;
  onSelect: (key: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart: (key: string) => void;
  onDragMove: (key: string, node: Konva.Node) => void;
  onDragEnd: () => void;
};

type TableNodeProps = ItemHandlers & {
  table: EditorTable;
  type: TableTypeOption | undefined;
  selected: boolean;
  /** Masa bir ekip grubundaysa halka rengi. */
  groupColor?: string | undefined;
};

export const TableNode = memo(function TableNode({ table, type, selected, groupColor, ...h }: TableNodeProps) {
  const shape = tableShapeOf(type);
  const size = effectiveTableSize({ size: table.size, capacity: table.capacity, isLoca: table.isLoca });
  const { width, height } = tableDims(shape, table.isLoca, size);
  const byCapacity = capacityColor(table.capacity);
  const fill = table.isVip ? VIP_FILL : table.isLoca ? LOCA_COLOR : (type?.color ?? byCapacity.fill);
  const baseStroke = table.isVip ? VIP_BORDER : type ? "#0f172a" : byCapacity.border;
  const stroke = selected ? SELECTED_STROKE : table.locked ? "#f8fafc" : baseStroke;
  const common = {
    fill,
    stroke,
    strokeWidth: selected ? 3 : 2,
    dash: table.locked && !selected ? [4, 3] : undefined,
    shadowColor: table.isVip ? VIP_FILL : "#000",
    shadowBlur: selected ? 8 : table.isVip ? 6 : 2,
    shadowOpacity: table.isVip ? 0.6 : 0.35,
  };
  const labelPx = size <= 28 ? 8 : size <= 40 ? 11 : 13;
  const showCapacity = !table.isLoca && size >= 44;
  return (
    <Group
      ref={(node) => h.register(table.key, node)}
      name="item"
      x={table.x}
      y={table.y}
      rotation={table.rotation}
      opacity={table.isPinned ? 0.85 : 1}
      draggable={h.draggable}
      onMouseDown={(e) => h.onSelect(table.key, e)}
      onTap={(e) => h.onSelect(table.key, e)}
      onDragStart={() => h.onDragStart(table.key)}
      onDragMove={(e) => h.onDragMove(table.key, e.target)}
      onDragEnd={h.onDragEnd}
    >
      {groupColor ? <GroupRing width={width} height={height} round={!table.isLoca && shape === "round"} color={groupColor} /> : null}
      {table.isLoca ? (
        <LocaBooth width={width} height={height} vip={table.isVip} stroke={selected ? SELECTED_STROKE : undefined} />
      ) : shape === "round" ? (
        <Circle radius={width / 2} {...common} />
      ) : (
        <Rect width={width} height={height} offsetX={width / 2} offsetY={height / 2} cornerRadius={6} {...common} />
      )}
      <Text
        text={table.label}
        width={width}
        offsetX={width / 2}
        offsetY={showCapacity ? 10 : labelPx / 2}
        align="center"
        wrap="none"
        ellipsis
        fontStyle="bold"
        fontSize={labelPx}
        fill="#ffffff"
        listening={false}
      />
      {showCapacity ? (
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
      ) : null}
      <TableBadges width={width} height={height} isVip={table.isVip} isPinned={table.isPinned} floor={table.floor} />
    </Group>
  );
});

type DecorNodeProps = ItemHandlers & { element: DecorElement; itemKey: string; selected: boolean };

/** Metin kutusu ve simge yerleşimi; dikey yönde metin 90° döndürülür. */
function decorLayout(element: DecorElement, hasIcon: boolean, hasText: boolean, vertical: boolean, iconPx: number) {
  const { width, height } = element;
  const iconLeft = hasIcon && hasText && !vertical && width >= height * 1.5;
  const iconTop = hasIcon && hasText && !iconLeft;
  const icon = {
    x: iconLeft ? 8 : (width - iconPx) / 2,
    y: iconLeft ? (height - iconPx) / 2 : iconTop ? 4 : (height - iconPx) / 2,
  };
  const leftInset = iconLeft ? iconPx + 16 : 0;
  const topInset = iconTop ? iconPx + 8 : 0;
  return { icon, text: { x: leftInset, y: topInset, width: width - leftInset, height: height - topInset } };
}

export const DecorNode = memo(function DecorNode({ element, itemKey, selected, ...h }: DecorNodeProps) {
  const style = resolveDecorStyle(element);
  const isText = element.kind === "label";
  const vertical = style.direction !== "horizontal";
  const hasText = element.label.length > 0;
  const iconPx = Math.max(12, Math.min(style.fontPx * 1.5, element.height - 8, element.width - 8));
  const lay = decorLayout(element, style.icon !== null, hasText, vertical, iconPx);
  const textColor = isText ? style.fill : "#ffffff";
  const drawBorder = !isText || element.borderColor !== undefined;
  const borderWidth = element.borderWidth ?? (isText ? 1 : style.borderWidth);
  const text = lay.text;
  const textProps = vertical
    ? {
        x: style.direction === "vertical-down" ? element.width : 0,
        y: style.direction === "vertical-down" ? text.y : text.y + text.height,
        width: text.height,
        height: element.width,
        rotation: style.direction === "vertical-down" ? 90 : -90,
      }
    : { x: text.x, y: text.y, width: text.width, height: text.height };
  const setTitle = (e: Konva.KonvaEventObject<MouseEvent>, title: string) => {
    const container = e.target.getStage()?.container();
    if (container) container.title = title;
  };
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
      onMouseEnter={element.tooltip ? (e) => setTitle(e, element.tooltip ?? "") : undefined}
      onMouseLeave={element.tooltip ? (e) => setTitle(e, "") : undefined}
      onDragStart={() => h.onDragStart(itemKey)}
      onDragMove={(e) => h.onDragMove(itemKey, e.target)}
      onDragEnd={h.onDragEnd}
    >
      <Rect
        width={element.width}
        height={element.height}
        fill={isText ? "transparent" : style.fill}
        opacity={style.opacity}
        cornerRadius={element.kind === "wall" ? 0 : 4}
      />
      {drawBorder || selected ? (
        <Rect
          width={element.width}
          height={element.height}
          stroke={selected ? SELECTED_STROKE : style.border}
          strokeWidth={selected ? Math.max(2, borderWidth) : borderWidth}
          strokeEnabled={selected || borderWidth > 0}
          dash={isText && selected ? [4, 3] : undefined}
          cornerRadius={element.kind === "wall" ? 0 : 4}
        />
      ) : null}
      {style.icon ? (
        <Path
          data={ICON_PATHS[style.icon]}
          x={lay.icon.x}
          y={lay.icon.y}
          scaleX={iconPx / 24}
          scaleY={iconPx / 24}
          stroke={textColor}
          strokeWidth={2}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      ) : null}
      {hasText ? (
        <Text
          {...textProps}
          text={element.label}
          align="center"
          verticalAlign="middle"
          fontFamily={style.fontCss}
          fontSize={style.fontPx}
          fontStyle="bold"
          fill={textColor}
          listening={false}
        />
      ) : null}
      {element.isPinned ? (
        <Group x={10} y={10} listening={false}>
          <Circle radius={8} fill="#f59e0b" />
          <Text text="🔒" fontSize={10} offsetX={6} offsetY={5} />
        </Group>
      ) : null}
    </Group>
  );
});
