"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import { BALLROOM } from "./palette";
import type { StageInfo } from "./stage";
import { WALL_MARGIN } from "./walls-geometry";

const SCREEN_W = 1152;
const SCREEN_H = 440;
const PHOTO_X = 680;
const CREST_SRC = "/brand/merit-royal-diamond.webp";

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    img
      .decode()
      .then(() => resolve(img))
      .catch(() => resolve(null));
  });
}

/** Sahne ekranı: lacivert degrade, Merit arması, altın çerçeve, solda etkinlik adı; görsel varsa sağda yumuşak geçişle yer alır. */
function drawScreen(
  ctx: CanvasRenderingContext2D,
  title: string,
  crest: HTMLImageElement | null,
  portrait: HTMLImageElement | null,
) {
  const grad = ctx.createLinearGradient(0, 0, SCREEN_W, SCREEN_H);
  grad.addColorStop(0, BALLROOM.screenGradStart);
  grad.addColorStop(0.64, BALLROOM.screenGradMid);
  grad.addColorStop(1, BALLROOM.screenGradEnd);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  if (portrait && portrait.naturalWidth > 0 && portrait.naturalHeight > 0) {
    const boxW = SCREEN_W - PHOTO_X;
    const scale = Math.max(boxW / portrait.naturalWidth, SCREEN_H / portrait.naturalHeight);
    const sw = boxW / scale;
    const sh = SCREEN_H / scale;
    const sx = (portrait.naturalWidth - sw) / 2;
    const sy = Math.max(0, (portrait.naturalHeight - sh) / 3);
    ctx.drawImage(portrait, sx, sy, sw, sh, PHOTO_X, 0, boxW, SCREEN_H);

    const blend = ctx.createLinearGradient(PHOTO_X, 0, PHOTO_X + 132, 0);
    blend.addColorStop(0, BALLROOM.screenBlend);
    blend.addColorStop(1, BALLROOM.screenBlendFade);
    ctx.fillStyle = blend;
    ctx.fillRect(PHOTO_X, 0, 132, SCREEN_H);

    const vignette = ctx.createLinearGradient(0, 0, 0, SCREEN_H);
    vignette.addColorStop(0, BALLROOM.screenVignetteTop);
    vignette.addColorStop(0.63, BALLROOM.screenBlendFade);
    vignette.addColorStop(1, BALLROOM.screenVignetteBot);
    ctx.fillStyle = vignette;
    ctx.fillRect(PHOTO_X, 0, boxW, SCREEN_H);
  }

  ctx.strokeStyle = BALLROOM.screenBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(19, 19, SCREEN_W - 38, SCREEN_H - 38);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  if (crest && crest.naturalWidth > 0) {
    ctx.drawImage(crest, 63, 61, 126, (126 * crest.naturalHeight) / crest.naturalWidth);
  }
  const inset = crest && crest.naturalWidth > 0 ? 213 : 63;
  ctx.fillStyle = BALLROOM.screenLabel;
  ctx.font = "bold 33px sans-serif";
  ctx.fillText("MERIT ENTERTAINMENT", inset, 116, 440);

  ctx.fillStyle = BALLROOM.warmWhite;
  ctx.font = "bold 92px Georgia, serif";
  ctx.fillText(title.slice(0, 40), 63, 295, portrait ? 602 : 1010);

  ctx.fillStyle = BALLROOM.screenBorder;
  ctx.fillRect(64, 323, 156, 3);
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
    drawScreen(ctx, title, null, null);
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, [title]);

  useEffect(() => () => texture?.dispose(), [texture]);

  useEffect(() => {
    if (!texture) return;
    let active = true;
    Promise.all([loadImg(CREST_SRC), artworkUrl ? loadImg(artworkUrl) : Promise.resolve(null)]).then(
      ([crest, portrait]) => {
        if (!active || (!crest && !portrait)) return;
        const ctx = (texture.image as HTMLCanvasElement).getContext("2d");
        if (!ctx) return;
        drawScreen(ctx, title, crest, portrait);
        texture.needsUpdate = true;
        invalidate();
      },
    );
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

      {/* Yan duvar ekranları (koyu pano + altın çerçeve) */}
      {showSideScreens ? (
        <>
          <group position={[-sideX, 4.18, 0]} rotation={[0, Math.PI / 2, 0]}>
            <mesh position={[0, 0, -0.22]}>
              <boxGeometry args={[13.1, 5.1, 0.4]} />
              <meshStandardMaterial color={BALLROOM.stage} roughness={0.8} />
            </mesh>
            <mesh position={[0, 0, -0.02]}>
              <boxGeometry args={[12.85, 4.86, 0.09]} />
              <meshStandardMaterial color={BALLROOM.trim} roughness={0.35} metalness={0.46} />
            </mesh>
            <mesh position={[0, 0, 0.04]}>
              <planeGeometry args={[12.6, 4.64]} />
              <meshBasicMaterial map={map} color={map ? BALLROOM.white : BALLROOM.stage} toneMapped={false} />
            </mesh>
          </group>
          <group position={[sideX, 4.18, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <mesh position={[0, 0, -0.22]}>
              <boxGeometry args={[13.1, 5.1, 0.4]} />
              <meshStandardMaterial color={BALLROOM.stage} roughness={0.8} />
            </mesh>
            <mesh position={[0, 0, -0.02]}>
              <boxGeometry args={[12.85, 4.86, 0.09]} />
              <meshStandardMaterial color={BALLROOM.trim} roughness={0.35} metalness={0.46} />
            </mesh>
            <mesh position={[0, 0, 0.04]}>
              <planeGeometry args={[12.6, 4.64]} />
              <meshBasicMaterial map={map} color={map ? BALLROOM.white : BALLROOM.stage} toneMapped={false} />
            </mesh>
          </group>
        </>
      ) : null}
    </group>
  );
}
