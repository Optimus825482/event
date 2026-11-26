"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { CanvasTexture, Color, type InstancedMesh, type Mesh, Object3D, RepeatWrapping, SRGBColorSpace, Vector3 } from "three";
import { chandelierPositions, type CameraPreset } from "./layout";
import { BALLROOM } from "./palette";

/** Altın/antrasit geometrik desenli halı (yerelde üretilir; dış kaynak indirilmez). */
function useCarpetTexture(width: number, depth: number): CanvasTexture | null {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = BALLROOM.carpet;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = BALLROOM.carpetLine;
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 256; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 64, 64);
      ctx.stroke();
    }
    const tex = new CanvasTexture(c);
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, []);
  useEffect(() => {
    texture?.repeat.set(Math.max(1, width / 4), Math.max(1, depth / 4));
  }, [texture, width, depth]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

export function BallroomFloor({ width, depth }: { width: number; depth: number }) {
  const carpet = useCarpetTexture(width, depth);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial map={carpet} color={carpet ? BALLROOM.white : BALLROOM.carpet} roughness={0.8} metalness={0.06} />
    </mesh>
  );
}

/** Sıcak, parlak balo salonu aydınlatması. */
export function BallroomLights({ width, depth, ceiling }: { width: number; depth: number; ceiling: number }) {
  const span = Math.max(width, depth);
  return (
    <>
      <ambientLight color={BALLROOM.warmWhite} intensity={1.35} />
      <hemisphereLight args={[BALLROOM.hemiSky, BALLROOM.hemiGround, 1.05]} />
      <directionalLight color={BALLROOM.warmLight} position={[width * 0.22, span * 0.55, depth * 0.35]} intensity={1.45} castShadow />
      <pointLight color={BALLROOM.warmPoint} position={[0, ceiling + 1, 0]} intensity={2.8} distance={span * 1.2} decay={0.6} />
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
          <meshBasicMaterial color={i % 2 === 0 ? BALLROOM.gold : BALLROOM.beamBlue} transparent opacity={0.07} side={2} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

export type ChairInstance = { x: number; y: number; z: number; rotationY: number; size: number; color: string };

/** Tüm sandalyeler tek örneklenmiş ağ ile çizilir (yüzlerce masada da akıcı). */
export function Chairs({ chairs }: { chairs: readonly ChairInstance[] }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new Object3D();
    const color = new Color();
    chairs.forEach((chair, i) => {
      dummy.position.set(chair.x, chair.y + chair.size * 0.9, chair.z);
      dummy.rotation.set(0, chair.rotationY, 0);
      dummy.scale.set(chair.size, chair.size * 1.8, chair.size);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.set(chair.color));
    });
    mesh.count = chairs.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [chairs]);
  if (chairs.length === 0) return null;
  // Anahtar: kapasite değişince tampon yeniden ayrılır.
  return (
    <instancedMesh key={chairs.length} ref={ref} args={[undefined, undefined, chairs.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={BALLROOM.white} roughness={0.45} />
    </instancedMesh>
  );
}

type ControlsLike = { target: Vector3; update: () => void };

/** Seçilen kamera açısına yumuşak geçiş (kübik yavaşlama). `nonce` aynı açıya yeniden uçmayı sağlar. */
export function CameraRig({ preset, nonce }: { preset: CameraPreset | null; nonce: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as ControlsLike | null;
  const flight = useRef<{ fromPos: Vector3; toPos: Vector3; fromTarget: Vector3; toTarget: Vector3; start: number } | null>(null);
  useEffect(() => {
    if (!preset || !controls) return;
    flight.current = {
      fromPos: camera.position.clone(),
      toPos: new Vector3(...preset.position),
      fromTarget: controls.target.clone(),
      toTarget: new Vector3(...preset.target),
      start: performance.now(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnızca yeni seçimde uç
  }, [nonce]);
  useFrame(() => {
    const f = flight.current;
    if (!f || !controls) return;
    const p = Math.min(1, (performance.now() - f.start) / 650);
    const eased = 1 - (1 - p) ** 3;
    camera.position.lerpVectors(f.fromPos, f.toPos, eased);
    controls.target.lerpVectors(f.fromTarget, f.toTarget, eased);
    controls.update();
    if (p >= 1) flight.current = null;
  });
  return null;
}
