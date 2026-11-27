"use client";

import { useMemo } from "react";
import { BALLROOM } from "./palette";
import { WALL_HEIGHT, WALL_THICKNESS, wallLayout, wallVisibility, type WallSpec } from "./walls-geometry";
import type { Vec3 } from "./metric";

const CORNICE_LEVELS = [0.23, 3.4, 7.57] as const;
const BAY_WIDTH = 5;

function BallroomWall({ spec }: { spec: WallSpec }) {
  const { length, height, side } = spec;
  const bayCount = Math.max(1, Math.round(length / BAY_WIDTH));
  const baySize = length / bayCount;
  const hasDoors = side !== "back";

  const bays = useMemo(
    () =>
      Array.from({ length: bayCount }, (_, i) => {
        const x = -length / 2 + (i + 0.5) * baySize;
        const isDoor = hasDoors && i % 4 === 2;
        return { x, isDoor };
      }),
    [bayCount, baySize, hasDoors, length],
  );

  const pilasters = useMemo(
    () => Array.from({ length: bayCount + 1 }, (_, i) => -length / 2 + i * baySize),
    [bayCount, baySize, length],
  );

  return (
    <group position={spec.position} rotation={[0, spec.rotationY, 0]}>
      {/* Ana duvar gövdesi */}
      <mesh position={[0, height / 2, -WALL_THICKNESS / 2]}>
        <boxGeometry args={[length, height, WALL_THICKNESS]} />
        <meshStandardMaterial color={BALLROOM.wall} roughness={0.78} metalness={0.1} />
      </mesh>

      {/* Üç yatay korniş */}
      {CORNICE_LEVELS.map((y) => (
        <mesh key={y} position={[0, y, 0.04]}>
          <boxGeometry args={[length, 0.14, 0.12]} />
          <meshStandardMaterial color={BALLROOM.trim} roughness={0.35} metalness={0.5} />
        </mesh>
      ))}

      {/* Pilaster kolonları (~5 m'de bir) */}
      {pilasters.map((x, idx) => (
        <mesh key={idx} position={[x, 3.85, 0.04]}>
          <boxGeometry args={[0.43, 7.3, 0.16]} />
          <meshStandardMaterial color={BALLROOM.travertine} roughness={0.75} metalness={0.08} />
        </mesh>
      ))}

      {/* Bölme panoları ve kapılar */}
      {bays.map((bay, idx) => (
        <group key={idx} position={[bay.x, 0, 0.02]}>
          {bay.isDoor ? (
            <mesh position={[0, 1.45, 0.02]}>
              <boxGeometry args={[Math.min(2.1, baySize * 0.55), 2.9, 0.08]} />
              <meshStandardMaterial color={BALLROOM.riser} roughness={0.7} metalness={0.12} />
            </mesh>
          ) : (
            <mesh position={[0, 1.35, 0.01]}>
              <boxGeometry args={[Math.max(0.5, baySize - 0.55), 2.35, 0.05]} />
              <meshStandardMaterial color={BALLROOM.panel} roughness={0.76} metalness={0.08} />
            </mesh>
          )}
          <mesh position={[0, 5.4, 0.01]}>
            <boxGeometry args={[Math.max(0.5, baySize - 0.55), 3.4, 0.04]} />
            <meshStandardMaterial color={BALLROOM.glassPanel} roughness={0.32} metalness={0.32} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Salon duvarları (kesit görünümü: kamera duvarın dışındaysa o duvar gizlenir) ve masadan bakış tavanı. */
export function SceneWalls({
  canvasWidth,
  canvasHeight,
  room,
  cameraPosition,
  pov,
}: {
  canvasWidth: number;
  canvasHeight: number;
  room: { width: number; depth: number };
  cameraPosition: Vec3;
  pov: boolean;
}) {
  const walls = useMemo(() => wallLayout(canvasWidth, canvasHeight), [canvasWidth, canvasHeight]);
  const vis = wallVisibility(room, cameraPosition, pov);

  return (
    <group name="venue-walls" userData={{ height: WALL_HEIGHT }}>
      {walls.map((spec) => (vis[spec.side] ? <BallroomWall key={spec.side} spec={spec} /> : null))}
      {pov ? (
        <mesh position={[0, WALL_HEIGHT, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[room.width + 1.2, room.depth + 1.2]} />
          <meshStandardMaterial color={BALLROOM.stage} roughness={0.85} />
        </mesh>
      ) : null}
    </group>
  );
}
