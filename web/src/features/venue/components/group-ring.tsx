"use client";

import { Circle, Rect } from "react-konva";

const RING_GAP = 5;

type Props = { width: number; height: number; round: boolean; color: string };

/** Ekip masa grubunun halkası: masanın dışında, grup renginde; tıklamayı engellemez (merkez 0,0). */
export function GroupRing({ width, height, round, color }: Props) {
  const common = { stroke: color, strokeWidth: 3, listening: false, opacity: 0.95 } as const;
  return round ? (
    <Circle radius={width / 2 + RING_GAP} {...common} />
  ) : (
    <Rect
      width={width + RING_GAP * 2}
      height={height + RING_GAP * 2}
      offsetX={width / 2 + RING_GAP}
      offsetY={height / 2 + RING_GAP}
      cornerRadius={10}
      {...common}
    />
  );
}
