"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { CanvasTexture, SRGBColorSpace, type Texture, TextureLoader } from "three";
import { BALLROOM } from "./palette";
import type { StageInfo } from "./stage";
import { WALL_MARGIN } from "./walls-geometry";

function createFallbackTexture(title: string): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 1152;
  c.height = 440;
  const ctx = c.getContext("2d");
  if (!ctx) return null;

  const grad = ctx.createLinearGradient(0, 0, c.width, c.height);
  grad.addColorStop(0, BALLROOM.screenGradStart);
  grad.addColorStop(0.64, BALLROOM.screenGradMid);
  grad.addColorStop(1, BALLROOM.screenGradEnd);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.strokeStyle = BALLROOM.gold;
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, c.width - 48, c.height - 48);

  ctx.fillStyle = BALLROOM.cream;
  ctx.font = "600 54px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title.slice(0, 36), c.width / 2, c.height / 2);

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export function StageScreen({
  stage,
  room,
  artworkUrl,
  title,
}: {
  stage: StageInfo;
  room: { width: number; depth: number };
  artworkUrl?: string | null;
  title?: string;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const [loaded, setLoaded] = useState<{ url: string; tex: Texture } | null>(null);
  const fallbackTex = useMemo(() => createFallbackTexture(title || "Merit Entertainment"), [title]);

  useEffect(() => () => fallbackTex?.dispose(), [fallbackTex]);

  useEffect(() => {
    if (!artworkUrl) return;
    let active = true;
    const loader = new TextureLoader();
    loader.load(
      artworkUrl,
      (tex) => {
        if (!active) {
          tex.dispose();
          return;
        }
        tex.colorSpace = SRGBColorSpace;
        setLoaded({ url: artworkUrl, tex });
        invalidate();
      },
      undefined,
      () => {
        if (active) setLoaded(null);
      },
    );
    return () => {
      active = false;
    };
  }, [artworkUrl, invalidate]);

  useEffect(() => () => loaded?.tex.dispose(), [loaded]);

  const map = (artworkUrl && loaded?.url === artworkUrl ? loaded.tex : null) ?? fallbackTex;
  const { position, rotationY, width, height } = stage.screen;
  const showSideScreens = room.depth >= 20;
  const sideX = room.width / 2 + WALL_MARGIN - 0.14;

  return (
    <group>
      {/* Ana sahne arkası koyu pano + ekran */}
      <group position={position} rotation={[0, rotationY, 0]}>
        <mesh position={[0, 0, -0.06]}>
          <boxGeometry args={[width + 1.7, height + 1.0, 0.1]} />
          <meshStandardMaterial color={BALLROOM.stage} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={map} color={map ? BALLROOM.white : BALLROOM.stage} toneMapped={false} />
        </mesh>
      </group>

      {/* Yan duvar ekranları */}
      {showSideScreens ? (
        <>
          <mesh position={[-sideX, 4.1, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[12.6, 4.64]} />
            <meshBasicMaterial map={map} color={map ? BALLROOM.white : BALLROOM.stage} toneMapped={false} />
          </mesh>
          <mesh position={[sideX, 4.1, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[12.6, 4.64]} />
            <meshBasicMaterial map={map} color={map ? BALLROOM.white : BALLROOM.stage} toneMapped={false} />
          </mesh>
        </>
      ) : null}
    </group>
  );
}
