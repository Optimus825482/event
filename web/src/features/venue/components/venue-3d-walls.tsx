"use client";

import { useTexture } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import { DoubleSide, SRGBColorSpace, type Texture } from "three";
import { fitLogo, wallLayout, WALL_HEIGHT, type WallSide, type WallSpec } from "./venue-3d-walls-geometry";

const LOGO_BY_SIDE: Record<WallSide, string> = {
  back: "/images/merit-royal-logo.png",
  left: "/images/merit-international-logo.png",
  right: "/images/merit-international-logo.png",
};
const PLAQUE_W = 6.4;
const PLAQUE_H = 2.5;

type ImageLike = { width?: number; height?: number };

function LogoPlaque({ url, y }: { url: string; y: number }) {
  const texture: Texture = useTexture(url, (loaded) => {
    for (const t of Array.isArray(loaded) ? loaded : [loaded]) t.colorSpace = SRGBColorSpace;
  });
  const image = texture.image as ImageLike | undefined;
  const aspect = image?.width && image.height ? image.width / image.height : 1;
  const logo = fitLogo(aspect, PLAQUE_W - 0.4, PLAQUE_H - 0.3);
  return (
    <group position={[0, y, 0.02]}>
      <mesh>
        <planeGeometry args={[PLAQUE_W, PLAQUE_H]} />
        <meshStandardMaterial
          color="#e2e8f0"
          emissive="#94a3b8"
          emissiveIntensity={0.35}
          transparent
          opacity={0.22}
          roughness={0.6}
          side={DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[logo.width, logo.height]} />
        <meshBasicMaterial map={texture} transparent side={DoubleSide} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

const WALL_COLOR = "#252432";
const GOLD = "#d4af37";

/** Koyu duvar, üstte altın korniş, altta altın süpürgelik ve logo levhası. */
function BallroomWall({ spec }: { spec: WallSpec }) {
  const { length, height } = spec;
  return (
    <group position={spec.position} rotation={[0, spec.rotationY, 0]}>
      <mesh position={[0, height / 2, -0.06]}>
        <boxGeometry args={[length, height, 0.12]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.72} metalness={0.12} />
      </mesh>
      <mesh position={[0, height - 0.06, 0.03]}>
        <boxGeometry args={[length, 0.12, 0.1]} />
        <meshStandardMaterial color={GOLD} roughness={0.28} metalness={0.82} />
      </mesh>
      <mesh position={[0, 0.04, 0.02]}>
        <boxGeometry args={[length, 0.08, 0.06]} />
        <meshStandardMaterial color={GOLD} roughness={0.28} metalness={0.82} />
      </mesh>
      <Suspense fallback={null}>
        <LogoPlaque url={LOGO_BY_SIDE[spec.side]} y={height * 0.55} />
      </Suspense>
    </group>
  );
}

/** Salonun arka, sol ve sağ tarafında altın kornişli duvarlar ve logo levhaları; ön taraf açık kalır. */
export default function Venue3DWalls({ canvasWidth, canvasHeight }: { canvasWidth: number; canvasHeight: number }) {
  const walls = useMemo(() => wallLayout(canvasWidth, canvasHeight), [canvasWidth, canvasHeight]);
  return (
    <group name="venue-walls" userData={{ height: WALL_HEIGHT }}>
      {walls.map((spec) => (
        <BallroomWall key={spec.side} spec={spec} />
      ))}
    </group>
  );
}
