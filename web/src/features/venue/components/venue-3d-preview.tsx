"use client";

import { Billboard, OrbitControls, Text } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { effectiveTableSize } from "../editor/geometry";
import type { EditorTable } from "../editor/store";
import type { DecorElement } from "../schemas";
import { tableShapeOf, useEditor, LOCA_COLOR, type TableTypeOption } from "./editor-context";
import { capacityColor, floorElevation, floorLabel, tableDims, VIP_FILL } from "./table-visual";
import Venue3DWalls from "./venue-3d-walls";

/** Tuvalde 50 piksel = 3B sahnede 1 birim (~1 metre). */
const PX = 50;
const TABLE_HEIGHT = 0.75;
const LOCA_HEIGHT = 0.9;
/**
 * 3B etiket yazı tipi: drei `Text` varsayılanı yazı tipini bir CDN'den indirir (CSP'ye takılır, çevrimdışı çalışmaz).
 * Türkçe karakterleri kapsayan Geist (SIL OFL 1.1) yerelden sunulur.
 */
const LABEL_FONT = "/fonts/Geist-Regular.ttf";
const DECOR_HEIGHT: Record<DecorElement["kind"], number> = { stage: 0.6, area: 0.02, wall: 2.6, label: 0 };

type Props = { tableTypes: readonly TableTypeOption[] };

/** Dekor öğesinin merkezini (dönüş sol-üst köşe çevresinde) ve açısını hesaplar. */
function decorCenter(e: DecorElement): { x: number; y: number; angle: number } {
  const angle = (e.rotation * Math.PI) / 180;
  const cx = (e.width / 2) * Math.cos(angle) - (e.height / 2) * Math.sin(angle);
  const cy = (e.width / 2) * Math.sin(angle) + (e.height / 2) * Math.cos(angle);
  return { x: e.x + cx, y: e.y + cy, angle };
}

type Capture = () => string | null;

/** Canvas içinden `gl`'ye erişip PNG üreten bir işlev kaydeder. */
function CaptureBridge({ captureRef }: { captureRef: { current: Capture | null } }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    captureRef.current = () => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL("image/png");
    };
    return () => {
      captureRef.current = null;
    };
  }, [captureRef, gl, scene, camera]);
  return null;
}

function Label({ text, position, size, flat = true }: { text: string; position: [number, number, number]; size: number; flat?: boolean }) {
  if (!text) return null;
  const content = (
    <Text
      font={LABEL_FONT}
      fontSize={size}
      color="#ffffff"
      outlineWidth={size * 0.08}
      outlineColor="#0f172a"
      anchorX="center"
      anchorY="middle"
      maxWidth={size * 8}
      rotation={flat ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}
    >
      {text}
    </Text>
  );
  return flat ? <group position={position}>{content}</group> : <Billboard position={position}>{content}</Billboard>;
}

type TableMeshProps = { table: EditorTable; type: TableTypeOption | undefined; toWorld: (x: number, y: number) => [number, number] };

function TableMesh({ table, type, toWorld }: TableMeshProps) {
  const shape = tableShapeOf(type);
  const size = effectiveTableSize({ size: table.size, capacity: table.capacity, isLoca: table.isLoca });
  const dims = tableDims(shape, table.isLoca, size);
  const [x, z] = toWorld(table.x, table.y);
  const base = floorElevation(table.floor);
  const height = table.isLoca ? LOCA_HEIGHT : TABLE_HEIGHT;
  const color = table.isVip ? VIP_FILL : table.isLoca ? LOCA_COLOR : (type?.color ?? capacityColor(table.capacity).fill);
  const w = dims.width / PX;
  const d = dims.height / PX;
  return (
    <group>
      {base > 0 ? (
        <mesh position={[x, base / 2, z]}>
          <cylinderGeometry args={[0.06, 0.06, base, 8]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
      ) : null}
      <mesh position={[x, base + height / 2, z]} rotation={[0, (-table.rotation * Math.PI) / 180, 0]} castShadow>
        {shape === "round" && !table.isLoca ? (
          <cylinderGeometry args={[w / 2, w / 2, height, 24]} />
        ) : (
          <boxGeometry args={[w, height, d]} />
        )}
        <meshStandardMaterial color={color} />
      </mesh>
      {table.isLoca ? (
        <Label text={table.label} position={[x, base + height + 0.45, z]} size={0.3} flat={false} />
      ) : (
        <Label text={table.label} position={[x, base + height + 0.01, z]} size={Math.min(0.3, w * 0.35)} />
      )}
    </group>
  );
}

function DecorMesh({ element, toWorld }: { element: DecorElement; toWorld: (x: number, y: number) => [number, number] }) {
  const c = decorCenter(element);
  const [x, z] = toWorld(c.x, c.y);
  const base = floorElevation(element.floor ?? 1);
  if (element.kind === "label") {
    return <Label text={element.label} position={[x, base + 0.02, z]} size={0.4} />;
  }
  const height = DECOR_HEIGHT[element.kind];
  return (
    <group>
      <mesh position={[x, base + height / 2, z]} rotation={[0, -c.angle, 0]} castShadow>
        <boxGeometry args={[element.width / PX, height, element.height / PX]} />
        <meshStandardMaterial color={element.color ?? "#64748b"} transparent={element.kind === "area"} opacity={element.kind === "area" ? 0.5 : 1} />
      </mesh>
      {element.kind === "stage" || element.kind === "area" ? (
        <Label
          text={element.label}
          position={[x, base + height + 0.02, z]}
          size={Math.min(0.6, element.width / PX / 8)}
        />
      ) : null}
    </group>
  );
}

/**
 * Yerleşimin 3B önizlemesi (salt okunur): zemin, masalar, loca kabinleri, sahne/duvar/alan blokları,
 * masa/loca/sahne yazıları, kata göre yükseltilmiş masalar ve PNG ekran görüntüsü.
 * Korkuluklar (balkon) yapılmadı.
 */
export default function Venue3DPreview({ tableTypes }: Props) {
  const tables = useEditor((s) => s.tables);
  const elements = useEditor((s) => s.elements);
  const canvas = useEditor((s) => s.canvas);
  const capture = useRef<Capture | null>(null);
  const typeById = useMemo(() => new Map(tableTypes.map((t) => [t.id, t])), [tableTypes]);
  const w = canvas.width / PX;
  const h = canvas.height / PX;
  const toWorld = useCallback((x: number, y: number): [number, number] => [x / PX - w / 2, y / PX - h / 2], [w, h]);
  const floorCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const t of tables) counts.set(t.floor, (counts.get(t.floor) ?? 0) + 1);
    return [...counts.entries()].sort(([a], [b]) => a - b);
  }, [tables]);

  const screenshot = () => {
    const url = capture.current?.();
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = `3d-yerlesim-${new Date().toISOString().slice(0, 10)}.png`;
    link.click();
  };

  return (
    <div className="relative h-full w-full bg-slate-950" data-testid="venue-3d">
      <Canvas camera={{ position: [0, Math.max(w, h) * 0.8, h * 0.9], fov: 50 }} shadows gl={{ preserveDrawingBuffer: true }}>
        <color attach="background" args={["#020617"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[w / 2, 20, h / 2]} intensity={1.1} castShadow />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        <gridHelper args={[Math.max(w, h), Math.round(Math.max(w, h)), "#334155", "#1e293b"]} position={[0, 0.005, 0]} />

        {elements.map((e) => (
          <DecorMesh key={e.id} element={e} toWorld={toWorld} />
        ))}
        {tables.map((t) => (
          <TableMesh key={t.key} table={t} type={t.tableTypeId ? typeById.get(t.tableTypeId) : undefined} toWorld={toWorld} />
        ))}
        <Venue3DWalls canvasWidth={canvas.width} canvasHeight={canvas.height} />
        <CaptureBridge captureRef={capture} />
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.1} />
      </Canvas>

      <button
        type="button"
        onClick={screenshot}
        className="absolute right-2 top-2 rounded-md border border-slate-600 bg-slate-800/90 px-3 py-1.5 text-sm text-slate-100 outline-none hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-ring"
      >
        Ekran görüntüsü
      </button>
      <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-slate-900/80 px-2 py-1 text-xs text-slate-300">
        Sol tık + sürükle: Döndür · Sağ tık + sürükle: Kaydır · Tekerlek: Yakınlaştır
      </p>
      {floorCounts.length > 1 ? (
        <ul aria-label="Katlar" className="pointer-events-none absolute bottom-2 right-2 rounded bg-slate-900/80 px-2 py-1 text-xs text-slate-200">
          {floorCounts.map(([floor, count]) => (
            <li key={floor}>
              {floorLabel(floor)}: {count} masa
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
