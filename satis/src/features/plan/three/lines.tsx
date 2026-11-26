"use client";

import { COLORS } from "@/lib/theme";
import { toWorld, WORLD_SCALE, type SceneLine } from "./scene-data";

const STRIP_HEIGHT = 0.02;
const MIN_STRIP_WIDTH = 0.05;

/** Ayırıcı çizgiler 3B zeminde ince şeritler olarak çizilir. */
export function SceneLines({ lines, canvas }: { lines: readonly SceneLine[]; canvas: { width: number; height: number } }) {
  return (
    <>
      {lines.map((l) => {
        const [x, z] = toWorld(canvas, l.cx, l.cy);
        return (
          <mesh key={l.id} position={[x, STRIP_HEIGHT / 2 + 0.006, z]} rotation={[0, -l.angle, 0]}>
            <boxGeometry args={[l.length / WORLD_SCALE, STRIP_HEIGHT, Math.max(MIN_STRIP_WIDTH, l.width / WORLD_SCALE)]} />
            <meshStandardMaterial color={COLORS.muted} emissive={COLORS.muted} emissiveIntensity={0.25} />
          </mesh>
        );
      })}
    </>
  );
}
