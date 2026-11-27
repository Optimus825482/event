"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Color, type InstancedMesh, Object3D, PerspectiveCamera } from "three";
import { Button } from "@/components/ui/button";
import { BallroomFloor, BallroomLights, Chairs, Chandeliers, StageBeams } from "./ballroom";
import {
  type CameraPose,
  CHAIR_PICK_DISTANCE,
  detailPose,
  FOV_HALL,
  maxDistance,
  MIN_DISTANCE,
  orbitMove,
  type OrbitMove,
  overviewPose,
  seatPose,
  topPose,
} from "./camera";
import { SeatLabels, TableLabels } from "./labels";
import { SceneLines } from "./lines";
import { type Vec3 } from "./metric";
import { BALLROOM } from "./palette";
import { chairHit, type SceneData, type SceneDecor, type SceneTable } from "./scene-data";
import { StageScreen } from "./screen";
import { towardStage } from "./stage";
import { SceneWalls } from "./walls";
import { WALL_HEIGHT } from "./walls-geometry";

export type SeatView = { tableId: string; nonce: number };

export type SceneProps = {
  scene: SceneData;
  canvas: { width: number; height: number };
  activeTableId: string | null;
  artworkUrl?: string | null;
  title?: string;
  seatView?: SeatView | null;
  onTable?(tableId: string): void;
  onSeat?(tableId: string, seatNo: number): void;
  onContextLost?: () => void;
  onReady?: () => void;
  onCameraChange?: (tag: string) => void;
  describedBy?: string;
};

type OrbitHandle = {
  target: { set(x: number, y: number, z: number): void; x: number; y: number; z: number };
  update(): void;
};

function ContextLossGuard({ onLost }: { onLost?: () => void }) {
  const dom = useThree((s) => s.gl.domElement);
  useEffect(() => {
    if (!onLost) return;
    const handler = (e: Event) => {
      e.preventDefault();
      onLost();
    };
    dom.addEventListener("webglcontextlost", handler);
    return () => dom.removeEventListener("webglcontextlost", handler);
  }, [dom, onLost]);
  return null;
}

const DECOR_HEIGHT: Record<SceneDecor["kind"], number> = {
  stage: 0.58,
  catwalk: 0.58,
  area: 0.02,
  wall: 2.6,
  label: 0,
  bar: 1.1,
};

function DecorMesh({ element }: { element: SceneDecor }) {
  const { width, depth, x, z, angle, kind } = element;
  const h = DECOR_HEIGHT[kind];
  if (h === 0) return null;
  const isStage = kind === "stage" || kind === "catwalk";
  const color =
    kind === "stage" || kind === "catwalk"
      ? BALLROOM.stage
      : kind === "bar"
        ? BALLROOM.wood
        : kind === "wall"
          ? BALLROOM.wall
          : BALLROOM.areaFallback;

  return (
    <group>
      <group position={[x, h / 2, z]} rotation={[0, angle, 0]}>
        <mesh>
          <boxGeometry args={[width, h, depth]} />
          <meshStandardMaterial
            color={color}
            roughness={kind === "area" ? 0.9 : 0.72}
            metalness={kind === "bar" ? 0.25 : 0.08}
            transparent={kind === "area"}
            opacity={kind === "area" ? 0.35 : 1}
          />
        </mesh>
        {isStage ? (
          <mesh position={[0, h / 2 - 0.022, 0]}>
            <boxGeometry args={[width + 0.08, 0.045, depth + 0.08]} />
            <meshStandardMaterial color={BALLROOM.trim} roughness={0.28} metalness={0.82} />
          </mesh>
        ) : null}
      </group>
      {kind === "stage" ? <StageBeams position={[x, z]} width={Math.max(width, depth)} base={h} /> : null}
    </group>
  );
}

function InstancedTables({
  tables,
  onTable,
}: {
  tables: readonly SceneTable[];
  onTable?: (tableId: string) => void;
}) {
  const roundTables = useMemo(() => tables.filter((t) => t.shape === "round" && !t.isLoca), [tables]);
  const boxTables = useMemo(() => tables.filter((t) => t.shape !== "round" || t.isLoca), [tables]);

  const roundRef = useRef<InstancedMesh>(null);
  const boxRef = useRef<InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);

  useLayoutEffect(() => {
    const dummy = new Object3D();
    const color = new Color();

    if (roundRef.current) {
      roundTables.forEach((t, i) => {
        dummy.position.set(t.x, t.floorY + 0.325, t.z);
        dummy.rotation.set(0, t.rotationY, 0);
        dummy.scale.set(t.width, 0.65, t.depth);
        dummy.updateMatrix();
        roundRef.current!.setMatrixAt(i, dummy.matrix);
        roundRef.current!.setColorAt(i, color.set(t.dimmed ? BALLROOM.dimmed : t.color));
      });
      roundRef.current.count = roundTables.length;
      roundRef.current.instanceMatrix.needsUpdate = true;
      if (roundRef.current.instanceColor) roundRef.current.instanceColor.needsUpdate = true;
    }

    if (boxRef.current) {
      boxTables.forEach((t, i) => {
        dummy.position.set(t.x, t.floorY + 0.325, t.z);
        dummy.rotation.set(0, t.rotationY, 0);
        dummy.scale.set(t.width, 0.65, t.depth);
        dummy.updateMatrix();
        boxRef.current!.setMatrixAt(i, dummy.matrix);
        boxRef.current!.setColorAt(i, color.set(t.dimmed ? BALLROOM.dimmed : t.color));
      });
      boxRef.current.count = boxTables.length;
      boxRef.current.instanceMatrix.needsUpdate = true;
      if (boxRef.current.instanceColor) boxRef.current.instanceColor.needsUpdate = true;
    }

    invalidate();
  }, [roundTables, boxTables, invalidate]);

  useEffect(() => () => {
    document.body.style.cursor = "";
  }, []);

  const handle = (list: readonly SceneTable[]) => ({
    onClick: (e: { instanceId?: number; delta: number; stopPropagation: () => void }) => {
      if (e.delta > 6 || e.instanceId === undefined) return;
      e.stopPropagation();
      const t = list[e.instanceId];
      if (t?.selectable) onTable?.(t.key);
    },
    onPointerOver: (e: { instanceId?: number }) => {
      if (e.instanceId === undefined) return;
      const t = list[e.instanceId];
      document.body.style.cursor = t?.selectable ? "pointer" : "not-allowed";
    },
    onPointerOut: () => {
      document.body.style.cursor = "";
    },
  });

  return (
    <group>
      {roundTables.length > 0 ? (
        <instancedMesh ref={roundRef} key={`r-${roundTables.length}`} args={[undefined, undefined, roundTables.length]} {...handle(roundTables)}>
          <cylinderGeometry args={[0.5, 0.45, 1, 24]} />
          <meshStandardMaterial roughness={0.38} metalness={0.25} />
        </instancedMesh>
      ) : null}
      {boxTables.length > 0 ? (
        <instancedMesh ref={boxRef} key={`b-${boxTables.length}`} args={[undefined, undefined, boxTables.length]} {...handle(boxTables)}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial roughness={0.38} metalness={0.25} />
        </instancedMesh>
      ) : null}
      {tables
        .filter((t) => t.picked || t.active)
        .map((t) => {
          const inner = (1.36 * Math.max(t.width, t.depth)) / 1.86;
          return (
            <mesh key={t.key} position={[t.x, t.floorY + 0.03, t.z]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[inner, inner + 0.16, 40]} />
              <meshBasicMaterial color={t.active ? BALLROOM.goldBright : BALLROOM.gold} toneMapped={false} />
            </mesh>
          );
        })}
    </group>
  );
}

type Flight = {
  fromPos: Vec3;
  fromTarget: Vec3;
  fromFov: number;
  to: CameraPose;
  tag: string;
  startedAt: number;
  duration: number;
};

function CameraController({
  scene,
  activeTableId,
  seatView,
  command,
  orbitRef,
  onPoseDone,
  onPovChange,
  onCamPos,
}: {
  scene: SceneData;
  activeTableId: string | null;
  seatView?: SeatView | null;
  command: { type: "overview" | "top" | OrbitMove; nonce: number } | null;
  orbitRef: React.RefObject<OrbitHandle | null>;
  onPoseDone: (tag: string) => void;
  onPovChange: (pov: boolean) => void;
  onCamPos: (pos: Vec3) => void;
}) {
  const { camera, size, invalidate } = useThree();
  const flightRef = useRef<Flight | null>(null);
  const narrow = size.height > 0 ? size.width / size.height < 1.15 : false;
  const maxDist = maxDistance(scene.room);

  const startFlight = useCallback(
    (to: CameraPose, tag: string) => {
      const ctrl = orbitRef.current;
      const curTarget: Vec3 = ctrl ? [ctrl.target.x, ctrl.target.y, ctrl.target.z] : [0, 1, 1];
      const fov = camera instanceof PerspectiveCamera ? camera.fov : FOV_HALL;
      flightRef.current = {
        fromPos: [camera.position.x, camera.position.y, camera.position.z],
        fromTarget: curTarget,
        fromFov: fov,
        to,
        tag,
        startedAt: performance.now(),
        duration: 580,
      };
      onPovChange(tag.startsWith("seat:"));
      invalidate();
    },
    [camera, orbitRef, onPovChange, invalidate],
  );

  // Etkin masa değişince yakınlaş
  const prevTableRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeTableId === prevTableRef.current) return;
    prevTableRef.current = activeTableId;
    if (!activeTableId) return;
    const t = scene.tables.find((x) => x.key === activeTableId);
    if (!t) return;
    const toStage = towardStage(scene.stage, { x: t.x, z: t.z });
    startFlight(detailPose({ x: t.x, z: t.z }, t.floorY, toStage), `detail:${t.key}`);
  }, [activeTableId, scene.tables, scene.stage, startFlight]);

  // Masadan bakış
  const prevSeatNonceRef = useRef<number>(0);
  useEffect(() => {
    if (!seatView || seatView.nonce === prevSeatNonceRef.current) return;
    prevSeatNonceRef.current = seatView.nonce;
    const t = scene.tables.find((x) => x.key === seatView.tableId);
    if (!t) return;
    startFlight(seatPose({ x: t.x, z: t.z }, t.floorY, scene.stage), `seat:${t.key}`);
  }, [seatView, scene.tables, scene.stage, startFlight]);

  // Kamera düğmeleri
  const prevCmdRef = useRef<number>(0);
  useEffect(() => {
    if (!command || command.nonce === prevCmdRef.current) return;
    prevCmdRef.current = command.nonce;
    if (command.type === "overview") {
      startFlight(overviewPose(scene.room, narrow), "overview");
      return;
    }
    if (command.type === "top") {
      startFlight(topPose(scene.room, narrow), "top");
      return;
    }
    const ctrl = orbitRef.current;
    const curTarget: Vec3 = ctrl ? [ctrl.target.x, ctrl.target.y, ctrl.target.z] : [0, 1, 1];
    const next = orbitMove(
      { position: [camera.position.x, camera.position.y, camera.position.z], target: curTarget },
      command.type,
      maxDist,
    );
    flightRef.current = null;
    camera.position.set(...next.position);
    ctrl?.target.set(...next.target);
    ctrl?.update();
    onCamPos(next.position);
    onPoseDone("free");
    invalidate();
  }, [command, scene.room, narrow, maxDist, camera, orbitRef, startFlight, onCamPos, onPoseDone, invalidate]);

  // Kullanıcı tutunca uçuş iptal
  useEffect(() => {
    const ctrl = orbitRef.current as unknown as { addEventListener?: (e: string, fn: () => void) => void; removeEventListener?: (e: string, fn: () => void) => void } | null;
    if (!ctrl?.addEventListener) return;
    const onStart = () => {
      if (flightRef.current) flightRef.current = null;
      onPovChange(false);
      onPoseDone("free");
    };
    ctrl.addEventListener("start", onStart);
    return () => ctrl.removeEventListener?.("start", onStart);
  }, [orbitRef, onPovChange, onPoseDone]);

  useFrame(() => {
    const f = flightRef.current;
    if (!f) return;
    const elapsed = performance.now() - f.startedAt;
    const raw = Math.min(1, elapsed / f.duration);
    const t = raw * raw * (3 - 2 * raw);

    const px = f.fromPos[0] + (f.to.position[0] - f.fromPos[0]) * t;
    const py = f.fromPos[1] + (f.to.position[1] - f.fromPos[1]) * t;
    const pz = f.fromPos[2] + (f.to.position[2] - f.fromPos[2]) * t;
    camera.position.set(px, py, pz);

    const tx = f.fromTarget[0] + (f.to.target[0] - f.fromTarget[0]) * t;
    const ty = f.fromTarget[1] + (f.to.target[1] - f.fromTarget[1]) * t;
    const tz = f.fromTarget[2] + (f.to.target[2] - f.fromTarget[2]) * t;
    orbitRef.current?.target.set(tx, ty, tz);

    if (camera instanceof PerspectiveCamera) {
      camera.fov = f.fromFov + (f.to.fov - f.fromFov) * t;
      camera.updateProjectionMatrix();
    }
    orbitRef.current?.update();
    onCamPos([px, py, pz]);

    if (raw >= 1) {
      const doneTag = f.tag;
      flightRef.current = null;
      onPoseDone(doneTag);
    } else {
      invalidate();
    }
  });

  return null;
}

export default function Scene3D({
  scene,
  canvas,
  activeTableId,
  artworkUrl,
  title,
  seatView,
  onTable,
  onSeat,
  onContextLost,
  onReady,
  onCameraChange,
  describedBy,
}: SceneProps) {
  const orbitRef = useRef<OrbitHandle | null>(null);
  const initialPose = useMemo(() => overviewPose(scene.room, false), [scene.room]);
  const [camPos, setCamPos] = useState<Vec3>(initialPose.position);
  const [pov, setPov] = useState(false);
  const [cmd, setCmd] = useState<{ type: "overview" | "top" | OrbitMove; nonce: number } | null>(null);

  const activeTable = useMemo(
    () => (activeTableId ? (scene.tables.find((t) => t.key === activeTableId) ?? null) : null),
    [activeTableId, scene.tables],
  );
  const activeChairs = useMemo(
    () => (activeTableId ? scene.chairs.filter((c) => c.tableId === activeTableId) : []),
    [activeTableId, scene.chairs],
  );
  const nearActive = useMemo(() => {
    if (!activeTable) return false;
    return Math.hypot(camPos[0] - activeTable.x, camPos[1] - activeTable.floorY, camPos[2] - activeTable.z) <= CHAIR_PICK_DISTANCE;
  }, [activeTable, camPos]);

  const sendCmd = (type: "overview" | "top" | OrbitMove) => setCmd((c) => ({ type, nonce: (c?.nonce ?? 0) + 1 }));

  const handleChairClick = useCallback(
    (instanceId: number, delta: number, stopPropagation: () => void) => {
      if (delta > 6) return;
      stopPropagation();
      const hit = chairHit(scene, instanceId);
      if (!hit) return;
      if (hit.tableId === activeTableId && hit.seatNo !== null && nearActive) {
        onSeat?.(hit.tableId, hit.seatNo);
      } else {
        onTable?.(hit.tableId);
      }
    },
    [scene, activeTableId, nearActive, onSeat, onTable],
  );

  const handleChairHover = useCallback(
    (instanceId: number) => {
      const hit = chairHit(scene, instanceId);
      if (!hit) return;
      const t = scene.tables.find((x) => x.key === hit.tableId);
      document.body.style.cursor = t?.selectable ? "pointer" : "not-allowed";
    },
    [scene],
  );

  return (
    <div className="relative h-full w-full bg-bg">
      <div role="img" aria-label="Salon planı (3B)" aria-describedby={describedBy} className="h-full w-full">
        <Canvas
          frameloop="demand"
          dpr={[1, 1.65]}
          camera={{ position: initialPose.position, fov: initialPose.fov }}
          gl={{ antialias: true, powerPreference: "low-power", toneMappingExposure: 1.15 }}
          style={{ touchAction: "pan-y" }}
          onCreated={() => {
            onReady?.();
            onCameraChange?.("overview");
          }}
        >
          <ContextLossGuard onLost={onContextLost} />
          <color attach="background" args={[BALLROOM.background]} />
          <BallroomLights />
          <BallroomFloor width={scene.room.width} depth={scene.room.depth} />
          <Chandeliers width={scene.room.width} height={WALL_HEIGHT - 0.7} />
          {scene.decor.map((e) => (
            <DecorMesh key={e.id} element={e} />
          ))}
          <StageScreen stage={scene.stage} room={scene.room} artworkUrl={artworkUrl} title={title} />
          <SceneLines lines={scene.lines} />
          <InstancedTables tables={scene.tables} onTable={onTable} />
          <Chairs
            chairs={scene.chairs}
            onClick={handleChairClick}
            onPointerOver={handleChairHover}
            onPointerOut={() => {
              document.body.style.cursor = "";
            }}
          />
          <TableLabels tables={scene.tables} />
          <SeatLabels chairs={activeChairs} visible={nearActive} />
          <SceneWalls
            canvasWidth={canvas.width}
            canvasHeight={canvas.height}
            room={scene.room}
            cameraPosition={camPos}
            pov={pov}
          />
          <OrbitControls
            ref={orbitRef as never}
            makeDefault
            enablePan={false}
            target={initialPose.target}
            minDistance={MIN_DISTANCE}
            maxDistance={maxDistance(scene.room)}
            maxPolarAngle={Math.PI / 2 - 0.012}
          />
          <CameraController
            scene={scene}
            activeTableId={activeTableId}
            seatView={seatView}
            command={cmd}
            orbitRef={orbitRef}
            onPoseDone={(tag) => onCameraChange?.(tag)}
            onPovChange={setPov}
            onCamPos={setCamPos}
          />
        </Canvas>
      </div>
      <div role="group" aria-label="Kamera" className="absolute left-2 top-2 flex max-w-[calc(100%-1rem)] flex-wrap gap-1.5">
        <Button variant="glass" onClick={() => sendCmd("left")}>
          Sola döndür
        </Button>
        <Button variant="glass" onClick={() => sendCmd("right")}>
          Sağa döndür
        </Button>
        <Button variant="glass" onClick={() => sendCmd("in")}>
          Yakınlaştır
        </Button>
        <Button variant="glass" onClick={() => sendCmd("out")}>
          Uzaklaştır
        </Button>
        <Button variant="glass" onClick={() => sendCmd("top")}>
          Üstten
        </Button>
        <Button variant="glass" onClick={() => sendCmd("overview")}>
          Genel
        </Button>
      </div>
    </div>
  );
}
