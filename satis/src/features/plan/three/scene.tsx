"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useCallback, useMemo, useState } from "react";
import { DoubleSide } from "three";
import { Button } from "@/components/ui/button";
import { COLORS } from "@/lib/theme";
import { BallroomFloor, BallroomLights, CameraRig, Chairs, Chandeliers, StageBeams, type ChairInstance } from "./ballroom";
import { cameraPresets, chairPlacements, chairSize, TABLE_BODY_SCALE, tableHeight, type CameraPresetId } from "./layout";
import { SceneLines } from "./lines";
import { BALLROOM } from "./palette";
import { toWorld, WORLD_SCALE, type SceneDecor, type SceneLine, type SceneTable } from "./scene-data";
import { SceneWalls } from "./walls";
import { WALL_HEIGHT } from "./walls-geometry";

const LOCA_HEIGHT = 0.9;
const STAGE_HEIGHT = 0.6;
const DECOR_HEIGHT: Record<SceneDecor["kind"], number> = { stage: STAGE_HEIGHT, area: 0.02, wall: 2.6, label: 0, bar: 1.1, catwalk: STAGE_HEIGHT };

type ToWorld = (x: number, y: number) => [number, number];
type StagePoint = { x: number; z: number };

export type SceneProps = {
  tables: readonly SceneTable[];
  decor: readonly SceneDecor[];
  lines: readonly SceneLine[];
  canvas: { width: number; height: number };
  onSelect?: (tableId: string) => void;
  /** WebGL bağlamı kaybolunca çağrılır; üst bileşen 2B'ye düşer. */
  onContextLost?: () => void;
};

type TableGeometry = { x: number; z: number; w: number; d: number; rot: number };

function tableGeometry(table: SceneTable, world: ToWorld): TableGeometry {
  const [x, z] = world(table.x, table.y);
  // Masa gövdesi plandaki alanından küçük çizilir; sandalyelerle birlikte o alana sığar.
  const scale = table.isLoca ? 1 : TABLE_BODY_SCALE;
  return { x, z, w: (table.width / WORLD_SCALE) * scale, d: (table.height / WORLD_SCALE) * scale, rot: (-table.rotation * Math.PI) / 180 };
}

/** Seçili masanın altında altın halka. */
function SelectionRing({ g }: { g: TableGeometry }) {
  const r = Math.max(g.w, g.d);
  return (
    <mesh position={[g.x, 0.03, g.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[r * 0.82, r * 0.82 + 0.18, 40]} />
      <meshBasicMaterial color={COLORS.goldBright} toneMapped={false} />
    </mesh>
  );
}

/** Masaya dokunma: yalnızca seçilebilir masa `onSelect` çağırır; imleç ona göre değişir. */
function useTablePointer(table: SceneTable, onSelect?: (id: string) => void) {
  return {
    onClick: (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      if (table.selectable) onSelect?.(table.key);
    },
    onPointerOver: () => {
      if (table.selectable) document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      document.body.style.cursor = "";
    },
  };
}

/** Fildişi örtülü masa; üst tablası masanın durum rengini taşır. */
function TableMesh({ table, world, onSelect }: { table: SceneTable; world: ToWorld; onSelect?: (id: string) => void }) {
  const g = tableGeometry(table, world);
  const round = table.shape === "round";
  const pointer = useTablePointer(table, onSelect);
  const dimmed = table.state === "full" || table.state === "closed";
  const height = tableHeight(g.w, g.d);
  const rim = height * 0.11;
  return (
    <group name={`table-${table.key}`} {...pointer}>
      <group position={[g.x, 0, g.z]} rotation={[0, g.rot, 0]}>
        <mesh position={[0, height / 2, 0]} castShadow>
          {round ? <cylinderGeometry args={[g.w / 2 - 0.02, g.w / 2, height, 24]} /> : <boxGeometry args={[g.w, height, g.d]} />}
          <meshStandardMaterial color={BALLROOM.cream} roughness={0.6} metalness={0.08} transparent={dimmed} opacity={dimmed ? 0.5 : 1} />
        </mesh>
        <mesh position={[0, height + rim / 2, 0]}>
          {round ? <cylinderGeometry args={[g.w / 2, g.w / 2, rim, 24]} /> : <boxGeometry args={[g.w + 0.02, rim, g.d + 0.02]} />}
          <meshStandardMaterial
            color={table.color}
            roughness={0.32}
            metalness={0.35}
            emissive={table.selected ? COLORS.goldBright : BALLROOM.black}
            emissiveIntensity={table.selected ? 0.6 : 0}
          />
        </mesh>
      </group>
      {table.selected ? <SelectionRing g={g} /> : null}
    </group>
  );
}

function locaFacing(g: TableGeometry, stage: StagePoint | null): number {
  if (!stage) return g.rot;
  const dx = stage.x - g.x;
  const dz = stage.z - g.z;
  const len = Math.hypot(dx, dz);
  return len < 0.01 ? g.rot : Math.atan2(-dx / len, -dz / len);
}

const locaRadius = (g: TableGeometry): number => (Math.max(g.w, g.d) / 2) * 1.1;

/** Loca: opera kabini; yarım daire fildişi korkuluk, pirinç tırabzan ve içinde özel masa. */
function LocaMesh({ table, world, stage, onSelect }: { table: SceneTable; world: ToWorld; stage: StagePoint | null; onSelect?: (id: string) => void }) {
  const g = tableGeometry(table, world);
  const r = locaRadius(g);
  const facing = locaFacing(g, stage);
  const pointer = useTablePointer(table, onSelect);
  const dimmed = table.state === "full" || table.state === "closed";
  const opacity = dimmed ? 0.5 : 1;
  const inner = r * 0.42;
  const wallHeight = Math.min(LOCA_HEIGHT * 0.9, r * 0.42);
  const th = tableHeight(inner * 2, inner * 2);
  return (
    <group name={`table-${table.key}`} {...pointer}>
      <group position={[g.x, 0, g.z]} rotation={[0, facing, 0]}>
        <mesh position={[0, 0.06, 0]} rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[r, r * 0.9, 0.12, 22, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color={BALLROOM.deck} roughness={0.7} transparent={dimmed} opacity={opacity} />
        </mesh>
        <mesh position={[0, 0.12 + wallHeight / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[r, r * 0.93, wallHeight, 22, 1, true, 0, Math.PI]} />
          <meshStandardMaterial color={BALLROOM.cream} roughness={0.6} metalness={0.08} side={DoubleSide} transparent={dimmed} opacity={opacity} />
        </mesh>
        <mesh position={[0, 0.12 + wallHeight, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r, 0.05, 8, 24, Math.PI]} />
          <meshStandardMaterial color={BALLROOM.gold} roughness={0.28} metalness={0.82} />
        </mesh>
        <mesh position={[0, 0.12 + th / 2, -r * 0.2]}>
          <cylinderGeometry args={[inner, inner * 0.9, th, 18]} />
          <meshStandardMaterial color={BALLROOM.wood} roughness={0.35} metalness={0.15} transparent={dimmed} opacity={opacity} />
        </mesh>
        <mesh position={[0, 0.12 + th + th * 0.055, -r * 0.2]}>
          <cylinderGeometry args={[inner * 1.04, inner * 1.04, th * 0.11, 18]} />
          <meshStandardMaterial
            color={table.color}
            roughness={0.32}
            metalness={0.35}
            emissive={table.selected ? COLORS.goldBright : BALLROOM.black}
            emissiveIntensity={table.selected ? 0.6 : 0}
          />
        </mesh>
      </group>
      {table.selected ? <SelectionRing g={g} /> : null}
    </group>
  );
}

/** Masaların ve locaların çevresindeki sandalyeler (kapasite kadar; tek örneklenmiş ağ). */
function sceneChairs(tables: readonly SceneTable[], world: ToWorld, stage: StagePoint | null): ChairInstance[] {
  const chairs: ChairInstance[] = [];
  for (const table of tables) {
    const g = tableGeometry(table, world);
    const dimmed = table.state === "full" || table.state === "closed";
    if (table.isLoca) {
      const r = locaRadius(g);
      const inner = r * 0.42;
      const size = chairSize(inner * 2, inner * 2);
      const facing = locaFacing(g, stage);
      const cos = Math.cos(facing);
      const sin = Math.sin(facing);
      const color = dimmed ? BALLROOM.dimmed : BALLROOM.loca;
      for (const c of chairPlacements(inner * 2, inner * 2, 0, Math.min(table.capacity, 8))) {
        const lx = c.x;
        const lz = c.z - r * 0.2;
        chairs.push({ x: g.x + lx * cos + lz * sin, y: 0.12, z: g.z - lx * sin + lz * cos, rotationY: c.rotationY + facing, size, color });
      }
      continue;
    }
    const color = dimmed ? BALLROOM.dimmed : BALLROOM.chair;
    const size = chairSize(g.w, g.d);
    for (const c of chairPlacements(g.w, g.d, table.rotation, table.capacity)) {
      chairs.push({ x: g.x + c.x, y: 0, z: g.z + c.z, rotationY: c.rotationY, size, color });
    }
  }
  return chairs;
}

const DECOR_STYLE: Record<Exclude<SceneDecor["kind"], "label" | "area">, { color: string; roughness: number; metalness: number; trim: boolean }> = {
  stage: { color: BALLROOM.stage, roughness: 0.42, metalness: 0.35, trim: true },
  catwalk: { color: BALLROOM.stage, roughness: 0.42, metalness: 0.35, trim: true },
  bar: { color: BALLROOM.wood, roughness: 0.35, metalness: 0.15, trim: true },
  wall: { color: BALLROOM.wall, roughness: 0.72, metalness: 0.12, trim: false },
};

function DecorMesh({ element, world }: { element: SceneDecor; world: ToWorld }) {
  // Yazı etiketi 3B'de çizilmez (yazı tipi/işçi dosyası gerekir; dış kaynak yok).
  if (element.kind === "label") return null;
  const [x, z] = world(element.x, element.y);
  const height = DECOR_HEIGHT[element.kind];
  const w = element.width / WORLD_SCALE;
  const d = element.height / WORLD_SCALE;
  const style = element.kind === "area" ? null : DECOR_STYLE[element.kind];
  return (
    <group>
      <group position={[x, 0, z]} rotation={[0, -element.angle, 0]}>
        <mesh position={[0, height / 2, 0]} castShadow>
          <boxGeometry args={[w, height, d]} />
          {style ? (
            <meshStandardMaterial color={style.color} roughness={style.roughness} metalness={style.metalness} />
          ) : (
            <meshStandardMaterial color={BALLROOM.areaFallback} transparent opacity={0.5} />
          )}
        </mesh>
        {style?.trim ? (
          <mesh position={[0, height - 0.04, 0]}>
            <boxGeometry args={[w + 0.08, 0.05, d + 0.08]} />
            <meshStandardMaterial color={BALLROOM.gold} roughness={0.28} metalness={0.82} />
          </mesh>
        ) : null}
      </group>
      {element.kind === "stage" ? <StageBeams position={[x, z]} width={Math.max(w, d)} base={height} /> : null}
    </group>
  );
}

/**
 * Satış planının 3B balo salonu sahnesi: desenli halı, altın ayrıntılı duvarlar, örtülü masalar ve sandalyeler,
 * loca kabinleri, avizeler, sahne ışıkları ve kamera açıları. Masaya dokunmak 2B'deki seçimle aynı yolu çağırır.
 */
export default function Scene3D({ tables, decor, lines, canvas, onSelect, onContextLost }: SceneProps) {
  const w = canvas.width / WORLD_SCALE;
  const h = canvas.height / WORLD_SCALE;
  const world = useCallback<ToWorld>((x, y) => toWorld(canvas, x, y), [canvas]);

  const presets = useMemo(() => {
    const stageEl = decor.find((e) => e.kind === "stage");
    const loca = tables.find((t) => t.isLoca);
    const point = (px: number, py: number) => {
      const [x, z] = world(px, py);
      return { x, z };
    };
    return cameraPresets(w, h, stageEl ? point(stageEl.x, stageEl.y) : null, loca ? { ...point(loca.x, loca.y), y: 0 } : null);
  }, [decor, tables, world, w, h]);
  const stagePoint = presets.find((p) => p.id === "stage")?.target;
  const stage = useMemo<StagePoint | null>(
    () => (stagePoint ? { x: stagePoint[0], z: stagePoint[2] } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnızca koordinatlar değişince
    [stagePoint?.[0], stagePoint?.[2]],
  );
  const chairs = useMemo(() => sceneChairs(tables, world, stage), [tables, world, stage]);
  const [view, setView] = useState<{ id: CameraPresetId; nonce: number }>({ id: "overview", nonce: 0 });
  const activePreset = presets.find((p) => p.id === view.id) ?? null;
  const overview = presets[0]?.position ?? [0, 10, 10];

  return (
    <div className="relative h-full w-full bg-bg" data-testid="plan-3d-scene">
      <div role="img" aria-label="Salon planı (3B)" className="h-full w-full">
      <Canvas
        camera={{ position: overview, fov: 46 }}
        shadows
        gl={{ toneMappingExposure: 1.15 }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", (event) => {
            event.preventDefault();
            onContextLost?.();
          });
        }}
      >
        <color attach="background" args={[BALLROOM.background]} />
        <fogExp2 attach="fog" args={[BALLROOM.background, 0.35 / Math.max(w, h, 20)]} />
        <BallroomLights width={w} depth={h} ceiling={WALL_HEIGHT} />
        <BallroomFloor width={w} depth={h} />
        <Chandeliers width={w} height={WALL_HEIGHT - 0.7} />
        {decor.map((e) => (
          <DecorMesh key={e.id} element={e} world={world} />
        ))}
        <SceneLines lines={lines} canvas={canvas} />
        {tables.map((t) =>
          t.isLoca ? (
            <LocaMesh key={t.key} table={t} world={world} stage={stage} onSelect={onSelect} />
          ) : (
            <TableMesh key={t.key} table={t} world={world} onSelect={onSelect} />
          ),
        )}
        <Chairs chairs={chairs} />
        <SceneWalls canvasWidth={canvas.width} canvasHeight={canvas.height} />
        <OrbitControls makeDefault enableDamping maxPolarAngle={Math.PI / 2.04} />
        <CameraRig preset={activePreset} nonce={view.nonce} />
      </Canvas>
      </div>
      <div role="group" aria-label="Kamera açıları" className="absolute left-2 top-2 flex max-w-[calc(100%-1rem)] flex-wrap gap-2">
        {presets.map((p) => (
          <Button
            key={p.id}
            variant="glass"
            aria-pressed={view.id === p.id}
            className="aria-pressed:bg-gold aria-pressed:text-on-gold"
            onClick={() => setView((v) => ({ id: p.id, nonce: v.nonce + 1 }))}
          >
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
