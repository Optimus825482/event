"use client";

import { useMemo } from "react";
import { BALLROOM } from "./palette";
import { wallLayout, WALL_HEIGHT, type WallSpec } from "./walls-geometry";

/** Koyu duvar, üstte altın korniş, altta altın süpürgelik (logo levhası yok: dış kaynak indirilmez). */
function BallroomWall({ spec }: { spec: WallSpec }) {
  const { length, height } = spec;
  return (
    <group position={spec.position} rotation={[0, spec.rotationY, 0]}>
      <mesh position={[0, height / 2, -0.06]}>
        <boxGeometry args={[length, height, 0.12]} />
        <meshStandardMaterial color={BALLROOM.wall} roughness={0.72} metalness={0.12} />
      </mesh>
      <mesh position={[0, height - 0.06, 0.03]}>
        <boxGeometry args={[length, 0.12, 0.1]} />
        <meshStandardMaterial color={BALLROOM.gold} roughness={0.28} metalness={0.82} />
      </mesh>
      <mesh position={[0, 0.04, 0.02]}>
        <boxGeometry args={[length, 0.08, 0.06]} />
        <meshStandardMaterial color={BALLROOM.gold} roughness={0.28} metalness={0.82} />
      </mesh>
    </group>
  );
}

/** Salonun arka, sol ve sağ tarafında altın kornişli duvarlar; ön taraf açık kalır. */
export function SceneWalls({ canvasWidth, canvasHeight }: { canvasWidth: number; canvasHeight: number }) {
  const walls = useMemo(() => wallLayout(canvasWidth, canvasHeight), [canvasWidth, canvasHeight]);
  return (
    <group name="venue-walls" userData={{ height: WALL_HEIGHT }}>
      {walls.map((spec) => (
        <BallroomWall key={spec.side} spec={spec} />
      ))}
    </group>
  );
}
