"use client";

import { Circle, Group, Rect, Text } from "react-konva";
import { LOCA_BORDER, PIN_BADGE_FILL, VIP_BORDER, VIP_FILL } from "./table-visual";

type BoothProps = { width: number; height: number; vip: boolean; stroke?: string | undefined };

/** Loca kabini: koyu zemin, sırtlık, oturak, kolçaklar ve alt kenarda neon pembe çubuk (merkez 0,0). */
export function LocaBooth({ width, height, vip, stroke }: BoothProps) {
  const border = stroke ?? (vip ? VIP_BORDER : LOCA_BORDER);
  const glow = vip ? VIP_FILL : LOCA_BORDER;
  return (
    <Group offsetX={width / 2} offsetY={height / 2}>
      <Rect
        width={width}
        height={height}
        cornerRadius={6}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: width, y: height }}
        fillLinearGradientColorStops={[0, "#1a1a2e", 1, "#0f172a"]}
        stroke={border}
        strokeWidth={2}
        shadowColor={glow}
        shadowBlur={6}
        shadowOpacity={0.6}
      />
      <Rect x={3} y={3} width={width - 6} height={height * 0.3} cornerRadius={3} fill="#2a1b4d" listening={false} />
      <Rect x={3} y={height * 0.62} width={width - 6} height={height * 0.32} cornerRadius={3} fill="#3b2667" listening={false} />
      <Rect x={1} y={height * 0.3} width={3} height={height * 0.4} fill="#2d1f55" listening={false} />
      <Rect x={width - 4} y={height * 0.3} width={3} height={height * 0.4} fill="#2d1f55" listening={false} />
      <Rect x={4} y={height - 4} width={width - 8} height={3} cornerRadius={1.5} fill={glow} listening={false} />
    </Group>
  );
}

type BadgeProps = { width: number; height: number; isVip: boolean; isPinned: boolean; floor: number };

/** Taç (VIP), kilit (sabit) ve kat rozetleri; erişilebilir karşılıkları özellikler panelindedir. */
export function TableBadges({ width, height, isVip, isPinned, floor }: BadgeProps) {
  const right = width / 2 - 2;
  const top = -height / 2 + 2;
  return (
    <>
      {isVip ? (
        <Group x={right} y={top} listening={false}>
          <Circle radius={8} fill={VIP_FILL} stroke="#ffffff" strokeWidth={1} />
          <Text text="👑" fontSize={10} offsetX={6} offsetY={5} />
        </Group>
      ) : null}
      {isPinned ? (
        <Group x={isVip ? -right : right} y={top} listening={false}>
          <Circle radius={6.5} fill={PIN_BADGE_FILL} stroke="#ffffff" strokeWidth={1} />
          <Text text="🔒" fontSize={8} offsetX={5} offsetY={4} />
        </Group>
      ) : null}
      {floor > 1 ? (
        <Group x={right - 12} y={height / 2 - 4} listening={false}>
          <Rect x={-14} y={-7} width={28} height={14} cornerRadius={7} fill="#be185d" stroke="#ffffff" strokeWidth={1} />
          <Text text={`${floor}. Kat`} x={-14} y={-4} width={28} align="center" fontSize={8} fontStyle="bold" fill="#ffffff" />
        </Group>
      ) : null}
    </>
  );
}
