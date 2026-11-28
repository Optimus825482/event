"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, CanvasTexture, DoubleSide, SRGBColorSpace } from "three";
import { BALLROOM } from "./palette";
import type { SceneChair, SceneTable } from "./scene-data";

const CELL = 48;
const COLS = 16;

function buildAtlas(labels: readonly string[], fg: string, maxAnisotropy: number, outline?: string): CanvasTexture | null {
  if (typeof document === "undefined" || labels.length === 0) return null;
  const rows = Math.ceil(labels.length / COLS);
  const c = document.createElement("canvas");
  c.width = COLS * CELL;
  c.height = rows * CELL;
  const ctx = c.getContext("2d");
  if (!ctx) return null;

  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = fg;
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3.5;
    ctx.lineJoin = "round";
  }

  labels.forEach((text, idx) => {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const x = (col + 0.5) * CELL;
    const y = (row + 0.51) * CELL;
    if (outline) ctx.strokeText(text, x, y, CELL - 5);
    ctx.fillText(text, x, y, CELL - 5);
  });

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function buildQuads(
  items: readonly { x: number; y: number; z: number; width: number; depth: number }[],
  totalRows: number,
): BufferGeometry | null {
  if (items.length === 0) return null;
  const positions = new Float32Array(items.length * 4 * 3);
  const uvs = new Float32Array(items.length * 4 * 2);
  const indices: number[] = [];

  items.forEach((item, idx) => {
    const hw = item.width / 2;
    const hd = item.depth / 2;
    const pBase = idx * 12;
    positions[pBase + 0] = item.x - hw;
    positions[pBase + 1] = item.y;
    positions[pBase + 2] = item.z + hd;
    positions[pBase + 3] = item.x + hw;
    positions[pBase + 4] = item.y;
    positions[pBase + 5] = item.z + hd;
    positions[pBase + 6] = item.x + hw;
    positions[pBase + 7] = item.y;
    positions[pBase + 8] = item.z - hd;
    positions[pBase + 9] = item.x - hw;
    positions[pBase + 10] = item.y;
    positions[pBase + 11] = item.z - hd;

    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const u0 = col / COLS;
    const u1 = (col + 1) / COLS;
    const v1 = 1 - row / totalRows;
    const v0 = 1 - (row + 1) / totalRows;

    const uBase = idx * 8;
    uvs[uBase + 0] = u0;
    uvs[uBase + 1] = v0;
    uvs[uBase + 2] = u1;
    uvs[uBase + 3] = v0;
    uvs[uBase + 4] = u1;
    uvs[uBase + 5] = v1;
    uvs[uBase + 6] = u0;
    uvs[uBase + 7] = v1;

    const vBase = idx * 4;
    indices.push(vBase, vBase + 1, vBase + 2, vBase, vBase + 2, vBase + 3);
  });

  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(positions, 3));
  geo.setAttribute("uv", new BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

export function TableLabels({ tables }: { tables: readonly SceneTable[] }) {
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const maxAniso = Math.min(4, gl?.capabilities?.getMaxAnisotropy?.() ?? 1);
  const layoutKey = tables.map((t) => `${t.key}:${t.label}:${t.x}:${t.floorY}:${t.z}`).join("|");

  const { texture, geometry } = useMemo(() => {
    const labels = tables.map((t) => t.label);
    const rows = Math.max(1, Math.ceil(labels.length / COLS));
    return {
      texture: buildAtlas(labels, BALLROOM.labelText, maxAniso, BALLROOM.labelOutline),
      geometry: buildQuads(
        // Masa etiketi quad'ı prototipte 1.34×1.00 m, y+0.716 (hall.js:299); loca kutusunda y+0.15.
        tables.map((t) => ({ x: t.x, y: t.floorY + (t.isLoca ? 0.15 : 0.716), z: t.z, width: 1.34, depth: 1.0 })),
        rows,
      ),
    };
    // layoutKey seçili/hover masa değişimlerinde atlasın gereksiz yere yeniden çizilmesini önler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey, maxAniso]);

  useEffect(() => {
    invalidate();
    return () => {
      texture?.dispose();
      geometry?.dispose();
    };
  }, [texture, geometry, invalidate]);

  if (!texture || !geometry) return null;
  return (
    <mesh geometry={geometry} renderOrder={1}>
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
        toneMapped={false}
        side={DoubleSide}
      />
    </mesh>
  );
}

export function SeatLabels({
  chairs,
  visible,
}: {
  chairs: readonly SceneChair[];
  visible: boolean;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const maxAniso = Math.min(4, gl?.capabilities?.getMaxAnisotropy?.() ?? 1);
  const numbered = useMemo(() => chairs.filter((c) => c.seatNo !== null), [chairs]);
  const { texture, geometry } = useMemo(() => {
    if (!visible || numbered.length === 0) return { texture: null, geometry: null };
    const labels = numbered.map((c) => String(c.seatNo));
    const rows = Math.max(1, Math.ceil(labels.length / COLS));
    return {
      texture: buildAtlas(labels, BALLROOM.warmWhite, maxAniso),
      geometry: buildQuads(
        numbered.map((c) => ({ x: c.x, y: c.y + 0.62, z: c.z, width: 0.42, depth: 0.42 })),
        rows,
      ),
    };
  }, [numbered, visible, maxAniso]);

  useEffect(() => {
    invalidate();
    return () => {
      texture?.dispose();
      geometry?.dispose();
    };
  }, [texture, geometry, invalidate]);

  if (!texture || !geometry) return null;
  return (
    <mesh geometry={geometry} renderOrder={1}>
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} side={DoubleSide} />
    </mesh>
  );
}
