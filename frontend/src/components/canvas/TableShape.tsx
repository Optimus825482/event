'use client';

import React, { useRef } from 'react';
import { Group, Circle, Rect, Text } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { CanvasTable } from '@/types';
import { useCanvasStore } from '@/store/canvas-store';
import { snapToGrid as snapFn, getContrastColor } from '@/lib/utils';
import { socketService } from '@/lib/socket';

interface TableShapeProps {
  table: CanvasTable;
  isSelected: boolean;
  snapToGrid: boolean;
  gridSize: number;
}

export function TableShape({ table, isSelected, snapToGrid, gridSize }: TableShapeProps) {
  const groupRef = useRef<any>(null);
  const { updateTable, setSelectedTables, selectedTableIds } = useCanvasStore();

  const color = table.tableType?.color || '#3b82f6';
  const size = getTableSize(table.tableType?.capacity || 8);

  // Masa boyutu (kapasiteye göre)
  function getTableSize(capacity: number): number {
    if (capacity <= 4) return 40;
    if (capacity <= 8) return 50;
    if (capacity <= 12) return 60;
    return 70;
  }

  // Tıklama
  const handleClick = (e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    if (e.evt.shiftKey) {
      // Multi-select
      if (selectedTableIds.includes(table.id)) {
        setSelectedTables(selectedTableIds.filter((id) => id !== table.id));
      } else {
        setSelectedTables([...selectedTableIds, table.id]);
      }
    } else {
      setSelectedTables([table.id]);
    }
  };

  // Sürükleme
  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    let newX = e.target.x();
    let newY = e.target.y();

    if (snapToGrid) {
      newX = snapFn(newX, gridSize);
      newY = snapFn(newY, gridSize);
    }

    updateTable(table.id, { x: newX, y: newY });
    socketService.sendTableMove(table.id, newX, newY, table.rotation);
  };

  const shape = table.tableType?.shape || 'round';
  const textColor = getContrastColor(color);

  return (
    <Group
      ref={groupRef}
      x={table.x}
      y={table.y}
      rotation={table.rotation}
      draggable
      onClick={handleClick}
      onDragEnd={handleDragEnd}
    >
      {/* Seçim halkası */}
      {isSelected && (
        <Circle
          radius={size + 8}
          stroke="#06b6d4"
          strokeWidth={2}
          dash={[5, 5]}
        />
      )}

      {/* Masa şekli */}
      {shape === 'round' ? (
        <Circle
          radius={size}
          fill={color}
          stroke={isSelected ? '#06b6d4' : '#1e293b'}
          strokeWidth={2}
          shadowColor="black"
          shadowBlur={isSelected ? 10 : 5}
          shadowOpacity={0.3}
        />
      ) : (
        <Rect
          x={-size}
          y={-size / 2}
          width={size * 2}
          height={size}
          fill={color}
          stroke={isSelected ? '#06b6d4' : '#1e293b'}
          strokeWidth={2}
          cornerRadius={8}
          shadowColor="black"
          shadowBlur={isSelected ? 10 : 5}
          shadowOpacity={0.3}
        />
      )}

      {/* Masa etiketi */}
      <Text
        text={table.label}
        fontSize={12}
        fontStyle="bold"
        fill={textColor}
        align="center"
        verticalAlign="middle"
        offsetX={shape === 'round' ? 0 : size}
        offsetY={6}
        width={size * 2}
      />

      {/* Durum göstergesi */}
      {table.status === 'reserved' && (
        <Circle
          x={size - 5}
          y={-size + 5}
          radius={6}
          fill="#eab308"
        />
      )}
      {table.status === 'occupied' && (
        <Circle
          x={size - 5}
          y={-size + 5}
          radius={6}
          fill="#22c55e"
        />
      )}
    </Group>
  );
}
