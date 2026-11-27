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
        const isDoor = hasDoors && i % 4 === 0;
        const hasSconce = i % 2 === 0;
        return { x, isDoor, hasSconce };
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
        <meshStandardMaterial color={BALLROOM.panel} roughness={0.81} metalness={0.05} />
      </mesh>

      {/* Üç yatay krem korniş */}
      {CORNICE_LEVELS.map((y) => (
        <mesh key={y} position={[0, y, 0.3]}>
          <boxGeometry args={[length, 0.27, 0.76]} />
          <meshStandardMaterial color={BALLROOM.pilaster} roughness={0.81} metalness={0.05} />
        </mesh>
      ))}

      {/* Pilaster kolonları, altın şerit ve başlık tacı */}
      {pilasters.map((x, idx) => (
        <group key={idx} position={[x, 0, 0]}>
          <mesh position={[0, 3.75, 0.37]}>
            <boxGeometry args={[0.43, 7.3, 0.55]} />
            <meshStandardMaterial color={BALLROOM.pilaster} roughness={0.81} metalness={0.05} />
          </mesh>
          <mesh position={[0, 4.4, 0.675]}>
            <boxGeometry args={[0.12, 4.7, 0.06]} />
            <meshStandardMaterial color={BALLROOM.trim} roughness={0.35} metalness={0.46} />
          </mesh>
          <mesh position={[0, 7.32, 0.44]}>
            <boxGeometry args={[0.66, 0.23, 0.75]} />
            <meshStandardMaterial color={BALLROOM.pilaster} roughness={0.81} metalness={0.05} />
          </mesh>
        </group>
      ))}

      {/* Bölme panoları, kapılar, üst camlar, altın kayıt ve aplikler */}
      {bays.map((bay, idx) => (
        <group key={idx} position={[bay.x, 0, 0]}>
          <mesh position={[0, 1.58, 0.25]}>
            <boxGeometry args={[baySize * 0.74, 2.35, 0.1]} />
            <meshStandardMaterial
              color={bay.isDoor ? BALLROOM.stage : BALLROOM.travertine}
              roughness={0.81}
              metalness={0.05}
            />
          </mesh>
          <mesh position={[0, 5.31, 0.26]}>
            <boxGeometry args={[baySize * 0.56, 2.4, 0.09]} />
            <meshStandardMaterial color={BALLROOM.glassPanel} roughness={0.32} metalness={0.32} />
          </mesh>
          <mesh position={[0, 4.07, 0.31]}>
            <boxGeometry args={[baySize * 0.62, 0.11, 0.15]} />
            <meshStandardMaterial color={BALLROOM.trim} roughness={0.35} metalness={0.46} />
          </mesh>
          {bay.hasSconce ? (
            <mesh position={[0, 3.3, 0.56]}>
              <boxGeometry args={[0.18, 0.47, 0.16]} />
              <meshBasicMaterial color={BALLROOM.goldLight} />
            </mesh>
          ) : null}
        </group>
      ))}
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
