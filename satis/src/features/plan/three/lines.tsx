"use client";

import { COLORS } from "@/lib/theme";
import type { SceneLine } from "./scene-data";

const STRIP_HEIGHT = 0.02;
const MIN_STRIP_WIDTH = 0.05;

/** Ayırıcı çizgiler 3B zeminde ince şeritler olarak çizilir. */
export function SceneLines({ lines }: { lines: readonly SceneLine[] }) {
  return (
    <>
      {lines.map((l) => (
        <mesh key={l.id} position={[l.cx, STRIP_HEIGHT / 2 + 0.006, l.cz]} rotation={[0, l.angle, 0]}>
          <boxGeometry args={[l.length, STRIP_HEIGHT, Math.max(MIN_STRIP_WIDTH, l.width)]} />
          <meshStandardMaterial color={COLORS.muted} emissive={COLORS.muted} emissiveIntensity={0.25} />
        </mesh>
      ))}
    </>
  );
}
