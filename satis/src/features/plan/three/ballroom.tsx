"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  type InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
} from "three";
import { chandelierPositions } from "./layout";
import { BALLROOM } from "./palette";
import type { SceneChair, SceneTable } from "./scene-data";
import type { StageInfo } from "./stage";

/** Altın/antrasit geometrik desenli halı (yerelde üretilir; dış kaynak indirilmez). */
function useCarpetTexture(width: number, depth: number): CanvasTexture | null {
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
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
    const maxAniso = gl?.capabilities?.getMaxAnisotropy?.() ?? 1;
    tex.anisotropy = Math.min(4, maxAniso);
    return tex;
  }, [gl]);

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

/** Sıcak ve lüks balo salonu aydınlatması (PBR ters-kare decay=2 kalibrasyonu). */
export function BallroomLights() {
  return (
    <>
      <ambientLight color={BALLROOM.warmWhite} intensity={1.35} />
      <hemisphereLight args={[BALLROOM.hemiSky, BALLROOM.hemiGround, 1.05]} />
      <directionalLight color={BALLROOM.warmLight} position={[16, 38, 22]} intensity={1.45} />
      <pointLight color={BALLROOM.warmPoint} position={[0, 14, 2]} intensity={260} distance={64} decay={2} />
      <pointLight color={BALLROOM.gold} position={[0, 10, -22]} intensity={320} distance={56} decay={2} />
    </>
  );
}

/** 3 katmanlı kristal tel kafes avizeler (paylaşılan geometri/materyal + dispose). */
export function Chandeliers({
  width,
  height,
  visible = true,
}: {
  width: number;
  height: number;
  visible?: boolean;
}) {
  const resources = useMemo(() => {
    const tier1Geo = new CylinderGeometry(2.1, 1.5, 1.3, 24, 1, true);
    const tier2Geo = new CylinderGeometry(1.4, 0.7, 1.0, 20, 1, true);
    const coreGeo = new SphereGeometry(0.65, 14, 14);
    const tier1Mat = new MeshStandardMaterial({
      color: BALLROOM.crystal,
      emissive: BALLROOM.gold,
      emissiveIntensity: 0.8,
      wireframe: true,
    });
    const tier2Mat = new MeshStandardMaterial({
      color: BALLROOM.crystal,
      emissive: BALLROOM.goldBright,
      emissiveIntensity: 0.9,
      wireframe: true,
    });
    const coreMat = new MeshBasicMaterial({ color: BALLROOM.crystalCore });
    return { tier1Geo, tier2Geo, coreGeo, tier1Mat, tier2Mat, coreMat };
  }, []);

  useEffect(() => {
    return () => {
      resources.tier1Geo.dispose();
      resources.tier2Geo.dispose();
      resources.coreGeo.dispose();
      resources.tier1Mat.dispose();
      resources.tier2Mat.dispose();
      resources.coreMat.dispose();
    };
  }, [resources]);

  if (!visible) return null;
  return (
    <>
      {chandelierPositions(width).map((x) => (
        <group key={x} position={[x, height, -2]}>
          <mesh geometry={resources.tier1Geo} material={resources.tier1Mat} />
          <mesh position={[0, -1.1, 0]} geometry={resources.tier2Geo} material={resources.tier2Mat} />
          <mesh geometry={resources.coreGeo} material={resources.coreMat} />
        </group>
      ))}
    </>
  );
}

const TRUSS_FIXTURES = [-8, -6, -4, -2, 0, 2, 4, 6, 8] as const;
const SPEAKER_SLATS = [4.15, 4.75, 5.35] as const;

/** Sahne üstü ışık köprüsü ve çift hatlı hoparlör kuleleri. */
export function StageRig({ stage }: { stage: StageInfo }) {
  const screenZ = stage.screen.position[2];
  const screenW = stage.screen.width;
  const scale = screenW / 13.9;
  const speakerOffset = screenW / 2 + 1.11;

  return (
    <group>
      {/* Üst ışık köprüsü ve 9 armatür */}
      <mesh position={[0, 6.65, screenZ + 0.46]}>
        <boxGeometry args={[screenW + 2.8, 0.26, 0.42]} />
        <meshStandardMaterial color={BALLROOM.stage} roughness={0.8} />
      </mesh>
      {TRUSS_FIXTURES.map((fx) => (
        <mesh key={fx} position={[fx * scale, 6.43, screenZ + 0.72]}>
          <boxGeometry args={[0.27, 0.14, 0.25]} />
          <meshBasicMaterial color={BALLROOM.goldLight} />
        </mesh>
      ))}
      {/* Çift hoparlör kulesi */}
      {[-speakerOffset, speakerOffset].map((sx) => (
        <group key={sx}>
          <mesh position={[sx, 4.9, screenZ + 0.96]}>
            <boxGeometry args={[0.55, 2.4, 0.63]} />
            <meshStandardMaterial color={BALLROOM.stage} roughness={0.8} />
          </mesh>
          {SPEAKER_SLATS.map((sy) => (
            <mesh key={sy} position={[sx, sy, screenZ + 1.0]}>
              <boxGeometry args={[0.44, 0.05, 0.65]} />
              <meshStandardMaterial color={BALLROOM.panel} roughness={0.78} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Kavisli opera-loca krem korkuluk, pirinç küpeşte ve kaide (paylaşılan materyaller + dispose). */
export function LocaArchitecture({ tables }: { tables: readonly SceneTable[] }) {
  const locas = useMemo(() => tables.filter((t) => t.isLoca), [tables]);
  const materials = useMemo(() => {
    const deckMat = new MeshStandardMaterial({ color: BALLROOM.deck, roughness: 0.7 });
    const creamMat = new MeshStandardMaterial({ color: BALLROOM.cream, roughness: 0.6, metalness: 0.08, side: DoubleSide });
    const trimMat = new MeshStandardMaterial({ color: BALLROOM.trim, roughness: 0.28, metalness: 0.82 });
    return { deckMat, creamMat, trimMat };
  }, []);

  useEffect(() => {
    return () => {
      materials.deckMat.dispose();
      materials.creamMat.dispose();
      materials.trimMat.dispose();
    };
  }, [materials]);

  if (locas.length === 0) return null;

  return (
    <group>
      {locas.map((t) => {
        const r = Math.max(1.6, t.width * 0.55);
        return (
          <group key={t.key} position={[t.x, t.floorY, t.z]} rotation={[0, t.rotationY, 0]}>
            <mesh position={[0, 0.05, 0]} rotation={[0, Math.PI / 2, 0]} material={materials.deckMat}>
              <cylinderGeometry args={[r - 0.03, r * 0.88, 0.28, 22, 1, false, 0, Math.PI]} />
            </mesh>
            <mesh position={[0, 0.52, 0]} rotation={[0, Math.PI / 2, 0]} material={materials.creamMat}>
              <cylinderGeometry args={[r, r * 0.92, 0.95, 22, 1, true, 0, Math.PI]} />
            </mesh>
            <mesh position={[0, 1.02, 0]} rotation={[Math.PI / 2, 0, Math.PI]} material={materials.trimMat}>
              <torusGeometry args={[r, 0.075, 8, 24, Math.PI]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Sahne üstü sabit açılı hacimsel spot ışıkları (`frameloop="demand"` ile uyumlu, paylaşılan geometri/materyal). */
export function StageBeams({ position, width, base }: { position: [number, number]; width: number; base: number }) {
  const offsets = useMemo(() => {
    const count = width > 6 ? 4 : 2;
    return Array.from({ length: count }, (_, i) => ((i + 0.5) / count - 0.5) * width * 0.8);
  }, [width]);
  const beamHeight = 10;

  const resources = useMemo(() => {
    const geo = new ConeGeometry(1.8, beamHeight, 16, 1, true);
    const goldMat = new MeshBasicMaterial({
      color: BALLROOM.gold,
      transparent: true,
      opacity: 0.07,
      side: DoubleSide,
      depthWrite: false,
    });
    const blueMat = new MeshBasicMaterial({
      color: BALLROOM.beamBlue,
      transparent: true,
      opacity: 0.07,
      side: DoubleSide,
      depthWrite: false,
    });
    return { geo, goldMat, blueMat };
  }, []);

  useEffect(() => {
    return () => {
      resources.geo.dispose();
      resources.goldMat.dispose();
      resources.blueMat.dispose();
    };
  }, [resources]);

  return (
    <>
      {offsets.map((dx, i) => (
        <mesh
          key={dx}
          geometry={resources.geo}
          material={i % 2 === 0 ? resources.goldMat : resources.blueMat}
          position={[position[0] + dx, base + beamHeight / 2, position[1]]}
          rotation={[0.24, 0, (i - (offsets.length - 1) / 2) * 0.14]}
        />
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
