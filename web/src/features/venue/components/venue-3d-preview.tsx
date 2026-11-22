"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import { tableSize } from "../editor/geometry";
import type { DecorElement } from "../schemas";
import { DEFAULT_TABLE_COLOR, LOCA_COLOR, tableShapeOf, useEditor, type TableTypeOption } from "./editor-context";

/** Tuvalde 50 piksel = 3B sahnede 1 birim (~1 metre). */
const PX = 50;
const TABLE_HEIGHT = 0.75;
const DECOR_HEIGHT: Record<DecorElement["kind"], number> = { stage: 0.6, area: 0.02, wall: 2.6, label: 0 };

type Props = { tableTypes: readonly TableTypeOption[] };

/** Dekor öğesinin merkezini (dönüş sol-üst köşe çevresinde) ve açısını hesaplar. */
function decorCenter(e: DecorElement): { x: number; y: number; angle: number } {
  const angle = (e.rotation * Math.PI) / 180;
  const cx = (e.width / 2) * Math.cos(angle) - (e.height / 2) * Math.sin(angle);
  const cy = (e.width / 2) * Math.sin(angle) + (e.height / 2) * Math.cos(angle);
  return { x: e.x + cx, y: e.y + cy, angle };
}

/**
 * Yerleşimin basit 3B önizlemesi (salt okunur): zemin, masalar, sahne/duvar/alan blokları.
 * Eski `Canvas3DPreview` bileşeninin sahne kurgusundan sadeleştirilmiştir (ışık, zemin, yörünge kamerası).
 */
export default function Venue3DPreview({ tableTypes }: Props) {
  const tables = useEditor((s) => s.tables);
  const elements = useEditor((s) => s.elements);
  const canvas = useEditor((s) => s.canvas);
  const typeById = useMemo(() => new Map(tableTypes.map((t) => [t.id, t])), [tableTypes]);
  const w = canvas.width / PX;
  const h = canvas.height / PX;
  const toWorld = (x: number, y: number): [number, number] => [x / PX - w / 2, y / PX - h / 2];

  return (
    <div className="h-full w-full bg-slate-950" data-testid="venue-3d">
      <Canvas camera={{ position: [0, Math.max(w, h) * 0.8, h * 0.9], fov: 50 }} shadows>
        <color attach="background" args={["#020617"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[w / 2, 20, h / 2]} intensity={1.1} castShadow />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        <gridHelper args={[Math.max(w, h), Math.round(Math.max(w, h)), "#334155", "#1e293b"]} position={[0, 0.005, 0]} />

        {elements
          .filter((e) => e.kind !== "label")
          .map((e) => {
            const c = decorCenter(e);
            const [x, z] = toWorld(c.x, c.y);
            const height = DECOR_HEIGHT[e.kind];
            return (
              <mesh key={e.id} position={[x, height / 2, z]} rotation={[0, -c.angle, 0]} castShadow>
                <boxGeometry args={[e.width / PX, height, e.height / PX]} />
                <meshStandardMaterial color={e.color ?? "#64748b"} transparent={e.kind === "area"} opacity={e.kind === "area" ? 0.5 : 1} />
              </mesh>
            );
          })}

        {tables.map((t) => {
          const type = t.tableTypeId ? typeById.get(t.tableTypeId) : undefined;
          const shape = tableShapeOf(type);
          const size = tableSize(shape, t.capacity);
          const [x, z] = toWorld(t.x, t.y);
          const color = t.isLoca ? LOCA_COLOR : (type?.color ?? DEFAULT_TABLE_COLOR);
          return (
            <mesh key={t.key} position={[x, TABLE_HEIGHT / 2, z]} rotation={[0, (-t.rotation * Math.PI) / 180, 0]} castShadow>
              {shape === "round" ? (
                <cylinderGeometry args={[size.width / PX / 2, size.width / PX / 2, TABLE_HEIGHT, 24]} />
              ) : (
                <boxGeometry args={[size.width / PX, TABLE_HEIGHT, size.height / PX]} />
              )}
              <meshStandardMaterial color={color} />
            </mesh>
          );
        })}
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.1} />
      </Canvas>
    </div>
  );
}
