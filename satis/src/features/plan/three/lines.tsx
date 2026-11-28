"use client";

import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import { type InstancedMesh, Object3D } from "three";
import { COLORS } from "@/lib/theme";
import type { SceneLine } from "./scene-data";

const STRIP_HEIGHT = 0.02;
const MIN_STRIP_WIDTH = 0.05;

/** Ayırıcı çizgiler 3B zeminde tek `InstancedMesh` çağrısıyla çizilir. */
export function SceneLines({ lines }: { lines: readonly SceneLine[] }) {
  const meshRef = useRef<InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || lines.length === 0) return;

    const dummy = new Object3D();
    lines.forEach((l, i) => {
      dummy.position.set(l.cx, STRIP_HEIGHT / 2 + 0.006, l.cz);
      dummy.rotation.set(0, l.angle, 0);
      dummy.scale.set(l.length, STRIP_HEIGHT, Math.max(MIN_STRIP_WIDTH, l.width));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.count = lines.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    invalidate();
  }, [lines, invalidate]);

  if (lines.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} key={lines.length} frustumCulled={false} args={[undefined, undefined, lines.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={COLORS.muted} emissive={COLORS.muted} emissiveIntensity={0.25} />
    </instancedMesh>
  );
}
