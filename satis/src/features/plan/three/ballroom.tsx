"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  CanvasTexture,
  Color,
  type InstancedMesh,
  type Mesh,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";
import { chandelierPositions } from "./layout";
import { BALLROOM } from "./palette";
import type { SceneChair } from "./scene-data";

/** Altın/antrasit geometrik desenli halı (yerelde üretilir; dış kaynak indirilmez). */
function useCarpetTexture(width: number, depth: number): CanvasTexture | null {
  const invalidate = useThree((s) => s.invalidate);
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = BALLROOM.carpet;
    ctx.fillRect(0, 0, 256, 256);
    // Sıcak tonlu, benekli dokuma; deterministik (her çizimde aynı desen).
    for (let i = 0; i < 320; i++) {
      ctx.fillStyle = BALLROOM.carpetFlecks[i % BALLROOM.carpetFlecks.length]!;
      ctx.fillRect((i * 7919) % 256, (i * i * 167 + i * 3) % 256, 6 + (i % 17), 2 + (i % 8));
    }
    // Dört karo içinde iç içe eşkenar dörtgen motif.
    ctx.strokeStyle = BALLROOM.carpetLine;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate((i % 2) * 128 + 64, Math.floor(i / 2) * 128 + 64);
      ctx.rotate(Math.PI / 4);
      ctx.strokeRect(-34, -34, 68, 68);
      ctx.strokeRect(-26, -26, 52, 52);
      ctx.restore();
    }
    const tex = new CanvasTexture(c);
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, []);

  useEffect(() => {
    if (!texture) return;
    texture.repeat.set(Math.max(1, width / 4.6), Math.max(1, depth / 4.6));
    invalidate();
  }, [texture, width, depth, invalidate]);

  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

export function BallroomFloor({ width, depth }: { width: number; depth: number }) {
  const carpetW = Math.max(2, width - 2.2);
  const carpetD = Math.max(2, depth - 2.2);
  const carpet = useCarpetTexture(carpetW, carpetD);

  return (
    <group>
      {/* Kaide ve traverten taban levhası */}
      <mesh position={[0, -0.32, 0]}>
        <boxGeometry args={[width + 1.4, 0.55, depth + 1.4]} />
        <meshStandardMaterial color={BALLROOM.riser} roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[width + 1.2, depth + 1.2]} />
        <meshStandardMaterial color={BALLROOM.travertine} roughness={0.81} metalness={0.05} />
      </mesh>
      {/* Halı */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[carpetW, carpetD]} />
        <meshStandardMaterial map={carpet} color={carpet ? BALLROOM.white : BALLROOM.carpet} roughness={0.82} metalness={0.05} />
      </mesh>
      {/* Halı kenarında pirinç şerit */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, -carpetD / 2]}>
        <planeGeometry args={[carpetW + 0.14, 0.07]} />
        <meshStandardMaterial color={BALLROOM.trim} roughness={0.35} metalness={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, carpetD / 2]}>
        <planeGeometry args={[carpetW + 0.14, 0.07]} />
        <meshStandardMaterial color={BALLROOM.trim} roughness={0.35} metalness={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-carpetW / 2, 0.004, 0]}>
        <planeGeometry args={[0.07, carpetD]} />
        <meshStandardMaterial color={BALLROOM.trim} roughness={0.35} metalness={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[carpetW / 2, 0.004, 0]}>
        <planeGeometry args={[0.07, carpetD]} />
        <meshStandardMaterial color={BALLROOM.trim} roughness={0.35} metalness={0.6} />
      </mesh>
    </group>
  );
}

/** Sıcak balo salonu aydınlatması (gölge haritası yok). */
export function BallroomLights() {
  return (
    <>
      <hemisphereLight args={[BALLROOM.hemiSky, BALLROOM.hemiGround, 2.15]} />
      <directionalLight color={BALLROOM.warmLight} position={[-8, 22, 6]} intensity={2.3} />
      <directionalLight color={BALLROOM.fillLight} position={[9, 13, -24]} intensity={0.65} />
    </>
  );
}

/** Çok katmanlı kristal avizeler (tel kafes + ışıklı çekirdek). */
export function Chandeliers({ width, height }: { width: number; height: number }) {
  const scale = Math.min(0.6, Math.max(0.3, width / 80));
  return (
    <>
      {chandelierPositions(width).map((x) => (
        <group key={x} position={[x, height, 0]} scale={scale}>
          <mesh>
            <cylinderGeometry args={[2.1, 1.5, 1.3, 24, 1, true]} />
            <meshStandardMaterial color={BALLROOM.crystal} emissive={BALLROOM.gold} emissiveIntensity={0.8} wireframe />
          </mesh>
          <mesh position={[0, -1.1, 0]}>
            <cylinderGeometry args={[1.4, 0.7, 1, 20, 1, true]} />
            <meshStandardMaterial color={BALLROOM.crystal} emissive={BALLROOM.goldBright} emissiveIntensity={0.9} wireframe />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.65, 14, 14]} />
            <meshBasicMaterial color={BALLROOM.crystalCore} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Sahnenin üstünde yavaşça salınan hacimsel spot ışıkları. */
export function StageBeams({ position, width, base }: { position: [number, number]; width: number; base: number }) {
  const refs = useRef<(Mesh | null)[]>([]);
  const offsets = useMemo(() => {
    const count = width > 6 ? 4 : 2;
    return Array.from({ length: count }, (_, i) => ((i + 0.5) / count - 0.5) * width * 0.8);
  }, [width]);
  const beamHeight = 3.6;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.6;
    refs.current.forEach((mesh, i) => {
      if (mesh) mesh.rotation.z = Math.sin(t + i * 1.4) * 0.22;
    });
  });
  return (
    <>
      {offsets.map((dx, i) => (
        <mesh
          key={dx}
          ref={(mesh) => {
            refs.current[i] = mesh;
          }}
          position={[position[0] + dx, base + beamHeight / 2, position[1]]}
        >
          <coneGeometry args={[0.7, beamHeight, 16, 1, true]} />
          <meshBasicMaterial
            color={i % 2 === 0 ? BALLROOM.gold : BALLROOM.beamBlue}
            transparent
            opacity={0.07}
            side={2}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}

/** Sandalyeler iki örneklenmiş ağ ile çizilir (oturak + arkalık); örnek sırası `chairs` dizisiyle birebir aynıdır. */
export function Chairs({
  chairs,
  onClick,
  onPointerOver,
  onPointerOut,
}: {
  chairs: readonly SceneChair[];
  onClick?: (instanceId: number, delta: number, stopPropagation: () => void) => void;
  onPointerOver?: (instanceId: number) => void;
  onPointerOut?: () => void;
}) {
  const seatRef = useRef<InstancedMesh>(null);
  const backRef = useRef<InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);

  useLayoutEffect(() => {
    const seatMesh = seatRef.current;
    const backMesh = backRef.current;
    if (!seatMesh || !backMesh) return;

    const dummy = new Object3D();
    const color = new Color();

    chairs.forEach((chair, i) => {
      dummy.position.set(chair.x, chair.y + 0.21, chair.z);
      dummy.rotation.set(0, chair.rotationY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      seatMesh.setMatrixAt(i, dummy.matrix);
      seatMesh.setColorAt(i, color.set(chair.color));

      const outX = -Math.sin(chair.rotationY) * 0.12;
      const outZ = -Math.cos(chair.rotationY) * 0.12;
      dummy.position.set(chair.x + outX, chair.y + 0.4, chair.z + outZ);
      dummy.rotation.set(0, chair.rotationY, 0);
      dummy.updateMatrix();
      backMesh.setMatrixAt(i, dummy.matrix);
      backMesh.setColorAt(i, color.set(chair.color));
    });

    seatMesh.count = chairs.length;
    seatMesh.instanceMatrix.needsUpdate = true;
    if (seatMesh.instanceColor) seatMesh.instanceColor.needsUpdate = true;
    seatMesh.computeBoundingSphere();

    backMesh.count = chairs.length;
    backMesh.instanceMatrix.needsUpdate = true;
    if (backMesh.instanceColor) backMesh.instanceColor.needsUpdate = true;
    backMesh.computeBoundingSphere();

    invalidate();
  }, [chairs, invalidate]);

  if (chairs.length === 0) return null;

  return (
    <group key={chairs.length}>
      <instancedMesh
        ref={seatRef}
        frustumCulled={false}
        args={[undefined, undefined, chairs.length]}
        onClick={(e) => {
          if (e.instanceId !== undefined) onClick?.(e.instanceId, e.delta, () => e.stopPropagation());
        }}
        onPointerOver={(e) => {
          if (e.instanceId !== undefined) onPointerOver?.(e.instanceId);
        }}
        onPointerOut={onPointerOut}
      >
        <boxGeometry args={[0.31, 0.28, 0.31]} />
        <meshStandardMaterial roughness={0.55} metalness={0.1} />
      </instancedMesh>
      <instancedMesh
        ref={backRef}
        frustumCulled={false}
        args={[undefined, undefined, chairs.length]}
        onClick={(e) => {
          if (e.instanceId !== undefined) onClick?.(e.instanceId, e.delta, () => e.stopPropagation());
        }}
        onPointerOver={(e) => {
          if (e.instanceId !== undefined) onPointerOver?.(e.instanceId);
        }}
        onPointerOut={onPointerOut}
      >
        <boxGeometry args={[0.32, 0.34, 0.085]} />
        <meshStandardMaterial roughness={0.55} metalness={0.1} />
      </instancedMesh>
    </group>
  );
}
