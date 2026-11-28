"use client";

import { useMemo } from "react";
import { BALLROOM } from "./palette";
import { WALL_HEIGHT, WALL_THICKNESS, wallLayout, wallVisibility, type WallSpec } from "./walls-geometry";
import type { Vec3 } from "./metric";

function BallroomWall({ spec }: { spec: WallSpec }) {
  const { length, height } = spec;

  return (
    <group position={spec.position} rotation={[0, spec.rotationY, 0]}>
      {/* Ana duvar gövdesi (meritevent/salon.html koyu antrasit duvar + altın tacı) */}
      <mesh position={[0, height / 2, -WALL_THICKNESS / 2]}>
        <boxGeometry args={[length, height, WALL_THICKNESS]} />
        <meshStandardMaterial color={BALLROOM.wall} roughness={0.72} metalness={0.12} />
      </mesh>
      <mesh position={[0, height - 0.22, 0.15]}>
        <boxGeometry args={[length, 0.45, 0.9]} />
        <meshStandardMaterial color={BALLROOM.trim} roughness={0.28} metalness={0.82} />
      </mesh>
    </group>
  );
}

/** Salon duvarları (kesit görünümü: kamera duvarın dışındaysa o duvar gizlenir) ve masadan bakış kasetli tavanı. */
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
  const beamX = useMemo(
    () => [-0.35 * room.width, -0.125 * room.width, 0.125 * room.width, 0.35 * room.width],
    [room.width],
  );
  const beamZ = useMemo(
    () => [-0.35 * room.depth, -0.12 * room.depth, 0.12 * room.depth, 0.35 * room.depth],
    [room.depth],
  );

  return (
    <group name="venue-walls" userData={{ height: WALL_HEIGHT }}>
      {walls.map((spec) => (vis[spec.side] ? <BallroomWall key={spec.side} spec={spec} /> : null))}
      {pov ? (
        <group>
          <mesh position={[0, WALL_HEIGHT + 0.1, 0]}>
            <boxGeometry args={[room.width + 1.2, 0.3, room.depth + 1.2]} />
            <meshStandardMaterial color={BALLROOM.pilaster} roughness={0.85} />
          </mesh>
          {beamX.map((x) => (
            <mesh key={`bx-${x}`} position={[x, WALL_HEIGHT - 0.14, 0]}>
              <boxGeometry args={[0.13, 0.16, room.depth]} />
              <meshStandardMaterial color={BALLROOM.trim} roughness={0.35} metalness={0.46} />
            </mesh>
          ))}
          {beamZ.map((z) => (
            <mesh key={`bz-${z}`} position={[0, WALL_HEIGHT - 0.14, z]}>
              <boxGeometry args={[room.width, 0.16, 0.13]} />
              <meshStandardMaterial color={BALLROOM.trim} roughness={0.35} metalness={0.46} />
            </mesh>
          ))}
        </group>
      ) : null}
    </group>
  );
}
