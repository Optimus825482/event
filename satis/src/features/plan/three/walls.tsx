"use client";

import { BoxGeometry, Color, Float32BufferAttribute } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { useEffect, useMemo } from "react";
import { BALLROOM } from "./palette";
import { WALL_HEIGHT, WALL_THICKNESS, wallLayout, wallVisibility, type WallSpec } from "./walls-geometry";
import type { Vec3 } from "./metric";

function BallroomWall({ spec }: { spec: WallSpec }) {
  const { length, height, side } = spec;
  // MERR salonundaki modüller, etkinliğin gerçek duvar uzunluğuna göre tekrarlanır.
  const geometry = useMemo(() => {
    const parts: BoxGeometry[] = [];
    function block(w: number, h: number, d: number, x: number, y: number, z: number, tint: string) {
      const box = new BoxGeometry(w, h, d).translate(x, y, z);
      const color = new Color(tint);
      const colors = new Float32Array(box.getAttribute("position").count * 3);
      for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
      box.setAttribute("color", new Float32BufferAttribute(colors, 3));
      parts.push(box);
    }
    block(length, height, WALL_THICKNESS, 0, height / 2, -WALL_THICKNESS / 2, BALLROOM.panel);
    for (const y of [0.23, 3.4, 7.57]) block(length, 0.27, 0.76, 0, y, 0.3, BALLROOM.cream);
    const bays = Math.max(1, Math.round(length / 5));
    const spacing = length / bays;
    for (let i = 0; i <= bays; i++) {
      const x = i * spacing - length / 2;
      block(0.43, 7.3, 0.55, x, 3.75, 0.37, BALLROOM.cream);
      block(0.12, 4.7, 0.06, x, 4.4, 0.675, BALLROOM.trim);
      block(0.66, 0.23, 0.75, x, 7.32, 0.44, BALLROOM.cream);
      if (i === bays) break;
      const center = x + spacing / 2;
      const door = side !== "back" && i % 4 === 0;
      block(spacing * 0.74, 2.35, 0.1, center, 1.58, 0.25, door ? BALLROOM.stage : BALLROOM.travertine);
      block(spacing * 0.56, 2.4, 0.09, center, 5.31, 0.26, BALLROOM.glassPanel);
      block(spacing * 0.62, 0.11, 0.15, center, 4.07, 0.31, BALLROOM.trim);
      if (i % 2 === 0) block(0.18, 0.47, 0.16, center, 3.3, 0.56, BALLROOM.goldLight);
    }
    const merged = mergeGeometries(parts);
    for (const part of parts) part.dispose();
    return merged;
  }, [length, height, side]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} position={spec.position} rotation={[0, spec.rotationY, 0]}>
      <meshStandardMaterial vertexColors roughness={0.8} metalness={0.08} />
    </mesh>
  );
}

/** Salon duvarları (kesit görünümü: kamera duvarın dışındaysa o duvar gizlenir). Tavan tekildir ve ballroom.tsx'te çizilir. */
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
    </group>
  );
}
