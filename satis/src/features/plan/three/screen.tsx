"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import { BALLROOM } from "./palette";
import type { StageInfo } from "./stage";
import { WALL_MARGIN } from "./walls-geometry";

const SCREEN_W = 1152;
const SCREEN_H = 440;
const PHOTO_X = 640;

/** Sahne ekranı: lacivert degrade, altın çerçeve, solda etkinlik adı; görsel varsa sağda (kırpılarak) yer alır. */
function drawScreen(ctx: CanvasRenderingContext2D, title: string, image: HTMLImageElement | null) {
  const grad = ctx.createLinearGradient(0, 0, SCREEN_W, SCREEN_H);
  grad.addColorStop(0, BALLROOM.screenGradStart);
  grad.addColorStop(0.64, BALLROOM.screenGradMid);
  grad.addColorStop(1, BALLROOM.screenGradEnd);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  if (image && image.naturalWidth > 0 && image.naturalHeight > 0) {
    const boxW = SCREEN_W - PHOTO_X;
    const scale = Math.max(boxW / image.naturalWidth, SCREEN_H / image.naturalHeight);
    const sw = boxW / scale;
    const sh = SCREEN_H / scale;
    const sx = (image.naturalWidth - sw) / 2;
    const sy = Math.max(0, (image.naturalHeight - sh) / 3);
    ctx.drawImage(image, sx, sy, sw, sh, PHOTO_X, 0, boxW, SCREEN_H);
    const blend = ctx.createLinearGradient(PHOTO_X, 0, PHOTO_X + 140, 0);
    blend.addColorStop(0, BALLROOM.screenGradMid);
    blend.addColorStop(1, BALLROOM.screenGradFade);
    ctx.fillStyle = blend;
    ctx.fillRect(PHOTO_X, 0, 140, SCREEN_H);
  }

  ctx.strokeStyle = BALLROOM.trim;
  ctx.lineWidth = 2;
  ctx.strokeRect(19, 19, SCREEN_W - 38, SCREEN_H - 38);

  const maxWidth = image ? PHOTO_X - 90 : SCREEN_W - 126;
  ctx.textAlign = image ? "left" : "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = BALLROOM.warmWhite;
  ctx.font = "bold 84px Georgia, serif";
  const x = image ? 63 : SCREEN_W / 2;
  ctx.fillText(title.slice(0, 40), x, 250, maxWidth);
  ctx.fillStyle = BALLROOM.trim;
  ctx.fillRect(image ? 64 : SCREEN_W / 2 - 78, 280, 156, 3);
}

function useScreenTexture(title: string, artworkUrl: string | null | undefined): CanvasTexture | null {
  const invalidate = useThree((s) => s.invalidate);
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = SCREEN_W;
    c.height = SCREEN_H;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    drawScreen(ctx, title, null);
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, [title]);

  useEffect(() => () => texture?.dispose(), [texture]);

  useEffect(() => {
    if (!texture || !artworkUrl) return;
    let active = true;
    const image = new Image();
    image.decoding = "async";
    image.src = artworkUrl;
    image
      .decode()
      .then(() => {
        const ctx = (texture.image as HTMLCanvasElement).getContext("2d");
        if (!active || !ctx) return;
        drawScreen(ctx, title, image);
        texture.needsUpdate = true;
        invalidate();
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [texture, artworkUrl, title, invalidate]);

  return texture;
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
  const map = useScreenTexture(title || "Merit Entertainment", artworkUrl);
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
