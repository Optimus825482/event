"use client";

import { Billboard, OrbitControls, Text } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DoubleSide } from "three";
import { effectiveTableSize } from "../editor/geometry";
import type { DecorElement, DecorLine } from "../schemas";
import { LOCA_COLOR } from "./editor-context";
import { floorElevation, floorLabel, tableDims } from "./table-visual";
import { BALLROOM, BallroomFloor, BallroomLights, CameraRig, Chairs, Chandeliers, StageBeams, type ChairInstance } from "./venue-3d-ballroom";
import { cameraPresets, chairPlacements, chairSize, TABLE_BODY_SCALE, tableHeight, type CameraPresetId } from "./venue-3d-layout";
import type { SceneTable } from "./venue-3d-scene-data";
import Venue3DLines from "./venue-3d-lines";
import Venue3DWalls from "./venue-3d-walls";
import { WALL_HEIGHT } from "./venue-3d-walls-geometry";
import { dateToZonedWallClock } from "@/lib/time-zone";

/** Tuvalde 50 piksel = 3B sahnede 1 birim (~1 metre). */
const PX = 50;
const LOCA_HEIGHT = 0.9;

const HIGHLIGHT_COLOR = "#facc15";
/**
 * 3B etiket yazı tipi: drei `Text` varsayılanı yazı tipini bir CDN'den indirir (CSP'ye takılır, çevrimdışı çalışmaz).
 * Türkçe karakterleri kapsayan Geist (SIL OFL 1.1) yerelden sunulur.
 */
const LABEL_FONT = "/fonts/Geist-Regular.ttf";
const STAGE_HEIGHT = 0.6;
/** Sahne üstü düğmeler: koyu cam zemin, açık yazı; seçili ve üzerine gelinen altın. Kontrast: #f7f5f0 / #11131a yaklaşık 16:1. */
const OVERLAY_BUTTON =
  "rounded-[10px] border border-white/10 bg-[#11131a]/90 px-3 py-1.5 text-xs font-semibold text-[#f7f5f0] outline-none backdrop-blur transition-colors hover:border-[#d4af37] hover:text-[#f0d068] focus-visible:ring-2 focus-visible:ring-[#f0d068] aria-pressed:border-[#d4af37] aria-pressed:text-[#f0d068]";
const DECOR_HEIGHT: Record<DecorElement["kind"], number> = { stage: STAGE_HEIGHT, area: 0.02, wall: 2.6, label: 0, bar: 1.1, catwalk: STAGE_HEIGHT };

type ToWorld = (x: number, y: number) => [number, number];

export type Venue3DSceneProps = {
  tables: readonly SceneTable[];
  elements: readonly DecorElement[];
  /** Ayırıcı çizgiler (zeminde ince şerit). */
  lines?: readonly DecorLine[];
  canvas: { width: number; height: number };
  ariaLabel?: string;
};

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

type TableGeometry = { x: number; z: number; base: number; w: number; d: number; rot: number };

function tableGeometry(table: SceneTable, toWorld: ToWorld): TableGeometry {
  const size = effectiveTableSize({ size: table.size, capacity: table.capacity, isLoca: table.isLoca });
  const dims = tableDims(table.shape, table.isLoca, size);
  const [x, z] = toWorld(table.x, table.y);
  // Masa gövdesi plandaki alanından küçük çizilir; sandalyelerle birlikte o alana sığar, komşu masalarla iç içe girmez.
  const scale = table.isLoca ? 1 : TABLE_BODY_SCALE;
  return { x, z, base: floorElevation(table.floor), w: (dims.width / PX) * scale, d: (dims.height / PX) * scale, rot: (-table.rotation * Math.PI) / 180 };
}

function Rings({ table, g }: { table: SceneTable; g: TableGeometry }) {
  const r = Math.max(g.w, g.d);
  return (
    <>
      {table.highlighted ? (
        <mesh position={[g.x, g.base + 0.03, g.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[r * 0.82, r * 0.82 + 0.18, 40]} />
          <meshBasicMaterial color={HIGHLIGHT_COLOR} toneMapped={false} />
        </mesh>
      ) : null}
      {table.outlined ? (
        <mesh position={[g.x, g.base + 0.025, g.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[r * 0.74, r * 0.74 + 0.1, 40]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      ) : null}
    </>
  );
}

function FloorPost({ g }: { g: TableGeometry }) {
  if (g.base <= 0) return null;
  return (
    <mesh position={[g.x, g.base / 2, g.z]}>
      <cylinderGeometry args={[0.06, 0.06, g.base, 8]} />
      <meshStandardMaterial color="#64748b" />
    </mesh>
  );
}

/** Fildişi örtülü masa; üst tablası masanın durum/tip rengini taşır. */
function TableMesh({ table, toWorld }: { table: SceneTable; toWorld: ToWorld }) {
  const g = tableGeometry(table, toWorld);
  const round = table.shape === "round";
  const lift = table.outlined ? 0.08 : 0;
  const opacity = table.dimmed ? 0.3 : 1;
  const height = tableHeight(g.w, g.d);
  const rim = height * 0.11;
  const top = g.base + height + lift;
  return (
    <group>
      <FloorPost g={g} />
      <group position={[g.x, g.base + lift, g.z]} rotation={[0, g.rot, 0]}>
        <mesh position={[0, height / 2, 0]} castShadow>
          {round ? <cylinderGeometry args={[g.w / 2 - 0.02, g.w / 2, height, 24]} /> : <boxGeometry args={[g.w, height, g.d]} />}
          <meshStandardMaterial color={BALLROOM.cream} roughness={0.6} metalness={0.08} transparent={table.dimmed} opacity={opacity} />
        </mesh>
        <mesh position={[0, height + rim / 2, 0]}>
          {round ? <cylinderGeometry args={[g.w / 2, g.w / 2, rim, 24]} /> : <boxGeometry args={[g.w + 0.02, rim, g.d + 0.02]} />}
          <meshStandardMaterial
            color={table.color}
            roughness={0.32}
            metalness={0.35}
            emissive={table.highlighted ? HIGHLIGHT_COLOR : "#000000"}
            emissiveIntensity={table.highlighted ? 0.6 : 0}
            transparent={table.dimmed}
            opacity={opacity}
          />
        </mesh>
      </group>
      <Rings table={table} g={g} />
      <Label text={table.label} position={[g.x, top + rim + 0.01, g.z]} size={Math.min(0.3, g.w * 0.35)} />
    </group>
  );
}

/** Locanın 3B rengi: varsayılan loca rengi balo salonunda altına döner; durum/grup renkleri korunur. */
function locaColor(table: SceneTable): string {
  return table.color.toLowerCase() === LOCA_COLOR.toLowerCase() ? BALLROOM.loca : table.color;
}

/** Locanın açık (korkuluklu) yüzünün baktığı yön: sahne varsa sahneye, yoksa masanın kendi dönüşü. */
function locaFacing(g: TableGeometry, stage: StagePoint | null): number {
  if (!stage) return g.rot;
  const dx = stage.x - g.x;
  const dz = stage.z - g.z;
  const len = Math.hypot(dx, dz);
  return len < 0.01 ? g.rot : Math.atan2(-dx / len, -dz / len);
}

function locaRadius(g: TableGeometry): number {
  return (Math.max(g.w, g.d) / 2) * 1.1;
}

/** Loca: opera kabini; yarım daire fildişi korkuluk, pirinç tırabzan ve içinde özel masa. */
function LocaMesh({ table, toWorld, stage }: { table: SceneTable; toWorld: ToWorld; stage: StagePoint | null }) {
  const g = tableGeometry(table, toWorld);
  const r = locaRadius(g);
  const color = locaColor(table);
  const facing = locaFacing(g, stage);
  const lift = table.outlined ? 0.08 : 0;
  const opacity = table.dimmed ? 0.3 : 1;
  const inner = r * 0.42;
  const wallHeight = Math.min(LOCA_HEIGHT * 0.9, r * 0.42);
  const th = tableHeight(inner * 2, inner * 2);
  return (
    <group>
      <group position={[g.x, g.base + lift, g.z]} rotation={[0, facing, 0]}>
        <mesh position={[0, 0.06, 0]} rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[r, r * 0.9, 0.12, 22, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color={BALLROOM.deck} roughness={0.7} transparent={table.dimmed} opacity={opacity} />
        </mesh>
        <mesh position={[0, 0.12 + wallHeight / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[r, r * 0.93, wallHeight, 22, 1, true, 0, Math.PI]} />
          <meshStandardMaterial color={BALLROOM.cream} roughness={0.6} metalness={0.08} side={DoubleSide} transparent={table.dimmed} opacity={opacity} />
        </mesh>
        <mesh position={[0, 0.12 + wallHeight, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r, 0.05, 8, 24, Math.PI]} />
          <meshStandardMaterial color={BALLROOM.gold} roughness={0.28} metalness={0.82} />
        </mesh>
        <mesh position={[0, 0.12 + th / 2, -r * 0.2]}>
          <cylinderGeometry args={[inner, inner * 0.9, th, 18]} />
          <meshStandardMaterial color={BALLROOM.wood} roughness={0.35} metalness={0.15} transparent={table.dimmed} opacity={opacity} />
        </mesh>
        <mesh position={[0, 0.12 + th + th * 0.055, -r * 0.2]}>
          <cylinderGeometry args={[inner * 1.04, inner * 1.04, th * 0.11, 18]} />
          <meshStandardMaterial
            color={color}
            roughness={0.32}
            metalness={0.35}
            emissive={table.highlighted ? HIGHLIGHT_COLOR : "#000000"}
            emissiveIntensity={table.highlighted ? 0.6 : 0}
            transparent={table.dimmed}
            opacity={opacity}
          />
        </mesh>
      </group>
      <Rings table={table} g={g} />
      <Label text={table.label} position={[g.x, g.base + wallHeight + 0.55, g.z]} size={0.3} flat={false} />
    </group>
  );
}

/** Masaların ve locaların çevresindeki sandalyeler (kapasite kadar; tek örneklenmiş ağ). */
function sceneChairs(tables: readonly SceneTable[], toWorld: ToWorld, stage: StagePoint | null): ChairInstance[] {
  const chairs: ChairInstance[] = [];
  for (const table of tables) {
    const g = tableGeometry(table, toWorld);
    if (table.isLoca) {
      const color = table.dimmed ? BALLROOM.dimmed : locaColor(table);
      const r = locaRadius(g);
      const inner = r * 0.42;
      const size = chairSize(inner * 2, inner * 2);
      const facing = locaFacing(g, stage);
      const cos = Math.cos(facing);
      const sin = Math.sin(facing);
      for (const c of chairPlacements(inner * 2, inner * 2, 0, Math.min(table.capacity, 8))) {
        const lx = c.x;
        const lz = c.z - r * 0.2;
        chairs.push({ x: g.x + lx * cos + lz * sin, y: g.base + 0.12, z: g.z - lx * sin + lz * cos, rotationY: c.rotationY + facing, size, color });
      }
      continue;
    }
    // Sandalyeler fildişi; masanın durum/tip rengini üst tabla taşır.
    const color = table.dimmed ? BALLROOM.dimmed : BALLROOM.chair;
    const size = chairSize(g.w, g.d);
    for (const c of chairPlacements(g.w, g.d, table.rotation, table.capacity)) {
      chairs.push({ x: g.x + c.x, y: g.base, z: g.z + c.z, rotationY: c.rotationY, size, color });
    }
  }
  return chairs;
}

type StagePoint = { x: number; z: number };

/** Üst kattaki locaların altındaki balkon: yarı saydam döşeme, altın ön kenar ve taşıyıcı kolonlar. */
function BalconyDecks({ tables, toWorld }: { tables: readonly SceneTable[]; toWorld: ToWorld }) {
  const decks = useMemo(() => {
    const byFloor = new Map<number, { minX: number; maxX: number; minZ: number; maxZ: number; base: number }>();
    for (const table of tables) {
      if (!table.isLoca) continue;
      const g = tableGeometry(table, toWorld);
      if (g.base <= 0) continue;
      const r = locaRadius(g) + 0.25;
      const box = byFloor.get(table.floor) ?? { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, base: g.base };
      box.minX = Math.min(box.minX, g.x - r);
      box.maxX = Math.max(box.maxX, g.x + r);
      box.minZ = Math.min(box.minZ, g.z - r);
      box.maxZ = Math.max(box.maxZ, g.z + r);
      byFloor.set(table.floor, box);
    }
    return [...byFloor.entries()];
  }, [tables, toWorld]);
  return (
    <>
      {decks.map(([floor, b]) => {
        const width = b.maxX - b.minX;
        const depth = b.maxZ - b.minZ;
        const cx = (b.minX + b.maxX) / 2;
        const cz = (b.minZ + b.maxZ) / 2;
        const columns: [number, number][] = [
          [b.minX + 0.15, b.minZ + 0.15],
          [b.maxX - 0.15, b.minZ + 0.15],
          [b.minX + 0.15, b.maxZ - 0.15],
          [b.maxX - 0.15, b.maxZ - 0.15],
        ];
        return (
          <group key={floor}>
            <mesh position={[cx, b.base - 0.12, cz]}>
              <boxGeometry args={[width, 0.24, depth]} />
              <meshStandardMaterial color={BALLROOM.balcony} roughness={0.7} transparent opacity={0.72} depthWrite={false} />
            </mesh>
            <mesh position={[cx, b.base + 0.01, cz]}>
              <boxGeometry args={[width + 0.1, 0.05, depth + 0.1]} />
              <meshStandardMaterial color={BALLROOM.gold} roughness={0.28} metalness={0.82} transparent opacity={0.35} depthWrite={false} />
            </mesh>
            {columns.map(([x, z]) => (
              <mesh key={`${x}:${z}`} position={[x, (b.base - 0.24) / 2, z]}>
                <cylinderGeometry args={[0.12, 0.14, b.base - 0.24, 12]} />
                <meshStandardMaterial color={BALLROOM.cream} roughness={0.6} metalness={0.08} />
              </mesh>
            ))}
          </group>
        );
      })}
    </>
  );
}

const DECOR_STYLE: Record<Exclude<DecorElement["kind"], "label" | "area">, { color: string; roughness: number; metalness: number; trim: boolean }> = {
  stage: { color: BALLROOM.stage, roughness: 0.42, metalness: 0.35, trim: true },
  catwalk: { color: BALLROOM.stage, roughness: 0.42, metalness: 0.35, trim: true },
  bar: { color: BALLROOM.wood, roughness: 0.35, metalness: 0.15, trim: true },
  wall: { color: BALLROOM.wall, roughness: 0.72, metalness: 0.12, trim: false },
};

function DecorMesh({ element, toWorld }: { element: DecorElement; toWorld: ToWorld }) {
  const c = decorCenter(element);
  const [x, z] = toWorld(c.x, c.y);
  const base = floorElevation(element.floor ?? 1);
  if (element.kind === "label") {
    return <Label text={element.label} position={[x, base + 0.02, z]} size={0.4} />;
  }
  const height = DECOR_HEIGHT[element.kind];
  const w = element.width / PX;
  const d = element.height / PX;
  const style = element.kind === "area" ? null : DECOR_STYLE[element.kind];
  return (
    <group>
      <group position={[x, base, z]} rotation={[0, -c.angle, 0]}>
        <mesh position={[0, height / 2, 0]} castShadow>
          <boxGeometry args={[w, height, d]} />
          {style ? (
            <meshStandardMaterial color={style.color} roughness={style.roughness} metalness={style.metalness} />
          ) : (
            <meshStandardMaterial color={element.color ?? "#64748b"} transparent opacity={0.5} />
          )}
        </mesh>
        {style?.trim ? (
          <mesh position={[0, height - 0.04, 0]}>
            <boxGeometry args={[w + 0.08, 0.05, d + 0.08]} />
            <meshStandardMaterial color={BALLROOM.gold} roughness={0.28} metalness={0.82} />
          </mesh>
        ) : null}
      </group>
      {element.kind === "stage" ? <StageBeams position={[x, z]} width={Math.max(w, d)} base={base + height} /> : null}
      {element.kind !== "wall" && element.label ? (
        <Label text={element.label} position={[x, base + height + 0.06, z]} size={Math.min(0.6, w / 8)} />
      ) : null}
    </group>
  );
}

/**
 * Yerleşimin 3B sahnesi (salt sunum): zemin, masalar, loca kabinleri, sahne/duvar/alan blokları,
 * masa/loca/sahne yazıları, kata göre yükseltilmiş masalar, vurgulu masa halkası ve PNG ekran görüntüsü.
 * Balo salonu görünümü: desenli halı, altın ayrıntılı duvarlar, örtülü masalar ve sandalyeler, loca kabinleri,
 * avizeler, sahne ışıkları ve kamera açıları. Düzenleyici ve salt okunur planlar aynı sahneyi kullanır.
 */
export default function Venue3DScene({ tables, elements, lines, canvas, ariaLabel }: Venue3DSceneProps) {
  const capture = useRef<Capture | null>(null);
  const w = canvas.width / PX;
  const h = canvas.height / PX;
  const toWorld = useCallback((x: number, y: number): [number, number] => [x / PX - w / 2, y / PX - h / 2], [w, h]);
  const floorCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const t of tables) counts.set(t.floor, (counts.get(t.floor) ?? 0) + 1);
    return [...counts.entries()].sort(([a], [b]) => a - b);
  }, [tables]);

  const presets = useMemo(() => {
    const stage = elements.find((e) => e.kind === "stage");
    const loca = tables.find((t) => t.isLoca);
    const point = (px: number, py: number) => {
      const [x, z] = toWorld(px, py);
      return { x, z };
    };
    const stageCenter = stage ? decorCenter(stage) : null;
    return cameraPresets(w, h, stageCenter ? point(stageCenter.x, stageCenter.y) : null, loca ? { ...point(loca.x, loca.y), y: floorElevation(loca.floor) } : null);
  }, [elements, tables, toWorld, w, h]);
  const stagePoint = presets.find((p) => p.id === "stage")?.target;
  const stage = useMemo<StagePoint | null>(
    () => (stagePoint ? { x: stagePoint[0], z: stagePoint[2] } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnızca koordinatlar değişince
    [stagePoint?.[0], stagePoint?.[2]],
  );
  const chairs = useMemo(() => sceneChairs(tables, toWorld, stage), [tables, toWorld, stage]);
  const [view, setView] = useState<{ id: CameraPresetId; nonce: number }>({ id: "overview", nonce: 0 });
  const activePreset = presets.find((p) => p.id === view.id) ?? null;
  const overview = presets[0]?.position ?? [0, 10, 10];

  const screenshot = () => {
    const url = capture.current?.();
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = `3d-yerlesim-${dateToZonedWallClock(new Date()).slice(0, 10)}.png`;
    link.click();
  };

  return (
    <div className="relative h-full w-full bg-[#050609]" data-testid="venue-3d" role={ariaLabel ? "group" : undefined} aria-label={ariaLabel}>
      <Canvas camera={{ position: overview, fov: 46 }} shadows gl={{ preserveDrawingBuffer: true, toneMappingExposure: 1.15 }}>
        <color attach="background" args={[BALLROOM.background]} />
        <fogExp2 attach="fog" args={[BALLROOM.background, 0.35 / Math.max(w, h, 20)]} />
        <BallroomLights width={w} depth={h} ceiling={WALL_HEIGHT} />
        <BallroomFloor width={w} depth={h} />
        <Chandeliers width={w} height={WALL_HEIGHT - 0.7} />

        {elements.map((e) => (
          <DecorMesh key={e.id} element={e} toWorld={toWorld} />
        ))}
        <Venue3DLines lines={lines ?? []} px={PX} toWorld={toWorld} />
        {tables.map((t) => (t.isLoca ? <LocaMesh key={t.key} table={t} toWorld={toWorld} stage={stage} /> : <TableMesh key={t.key} table={t} toWorld={toWorld} />))}
        <BalconyDecks tables={tables} toWorld={toWorld} />
        <Chairs chairs={chairs} />
        <Venue3DWalls canvasWidth={canvas.width} canvasHeight={canvas.height} />
        <CaptureBridge captureRef={capture} />
        <OrbitControls makeDefault enableDamping maxPolarAngle={Math.PI / 2.04} />
        <CameraRig preset={activePreset} nonce={view.nonce} />
      </Canvas>

      <div role="group" aria-label="Kamera açıları" className="absolute left-2 top-2 flex max-w-[calc(100%-9.5rem)] flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={view.id === p.id}
            onClick={() => setView((v) => ({ id: p.id, nonce: v.nonce + 1 }))}
            className={OVERLAY_BUTTON}
          >
            {p.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={screenshot}
        className={`absolute right-2 top-2 ${OVERLAY_BUTTON}`}
      >
        Ekran görüntüsü
      </button>
      <p className="pointer-events-none absolute bottom-2 left-2 rounded-lg border border-white/10 bg-[#11131a]/90 px-2.5 py-1 text-xs text-[#a6aab8] backdrop-blur">
        Sol tık + sürükle: Döndür · Sağ tık + sürükle: Kaydır · Tekerlek: Yakınlaştır
      </p>
      {floorCounts.length > 1 ? (
        <ul aria-label="Katlar" className="pointer-events-none absolute bottom-2 right-2 rounded-lg border border-white/10 bg-[#11131a]/90 px-2.5 py-1 text-xs text-[#f7f5f0] backdrop-blur">
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
