"use client";

import { lineStrip } from "../editor/lines";
import type { DecorLine } from "../schemas";

const STRIP_HEIGHT = 0.02;
const MIN_STRIP_WIDTH = 0.05;

type Props = {
  lines: readonly DecorLine[];
  /** Tuval pikselinin 3B birim karşılığı (sahnede 50 px = 1 birim). */
  px: number;
  toWorld: (x: number, y: number) => [number, number];
};

/** Ayırıcı çizgiler 3B zeminde ince şeritler olarak çizilir. */
export default function Venue3DLines({ lines, px, toWorld }: Props) {
  return (
    <>
      {lines.map((l) => {
        const strip = lineStrip(l);
        const [x, z] = toWorld(strip.cx, strip.cy);
        return (
          <mesh key={l.id} position={[x, STRIP_HEIGHT / 2 + 0.006, z]} rotation={[0, -strip.angle, 0]}>
            <boxGeometry args={[strip.length / px, STRIP_HEIGHT, Math.max(MIN_STRIP_WIDTH, l.width / px)]} />
            <meshStandardMaterial color={l.color} emissive={l.color} emissiveIntensity={0.25} />
          </mesh>
        );
      })}
    </>
  );
}
