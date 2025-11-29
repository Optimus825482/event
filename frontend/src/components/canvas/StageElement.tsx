'use client';

import React from 'react';
import { Group, Rect, Text } from 'react-konva';

interface StageElementProps {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function StageElement({ x, y, width, height }: StageElementProps) {
  return (
    <Group x={x} y={y}>
      {/* Sahne arka planı */}
      <Rect
        width={width}
        height={height}
        fill="#1e293b"
        stroke="#8b5cf6"
        strokeWidth={3}
        cornerRadius={8}
        shadowColor="purple"
        shadowBlur={15}
        shadowOpacity={0.5}
      />

      {/* Sahne yazısı */}
      <Text
        text="SAHNE"
        fontSize={18}
        fontStyle="bold"
        fill="#8b5cf6"
        width={width}
        height={height}
        align="center"
        verticalAlign="middle"
      />
    </Group>
  );
}
