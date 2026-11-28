"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ACESFilmicToneMapping, Color, DoubleSide, type InstancedMesh, Object3D, PerspectiveCamera } from "three";
import { BallroomFloor, BallroomLights, Chairs, Chandeliers, LocaArchitecture, StageBeams, StageRig } from "./ballroom";
import {
  type CameraPose,
  CHAIR_PICK_DISTANCE,
  FOV_HALL,
  locaPose,
  maxDistance,
  MIN_DISTANCE,
  orbitMove,
  type OrbitMove,
  overviewPose,
  seatPose,
  stagePose,
  topPose,
} from "./camera";
import { SeatLabels, TableLabels } from "./labels";
import { SceneLines } from "./lines";
import { type Vec3 } from "./metric";
import { BALLROOM } from "./palette";
import { chairHit, type SceneData, type SceneDecor, type SceneTable } from "./scene-data";
import { StageScreen } from "./screen";
import { SceneWalls } from "./walls";
import { WALL_HEIGHT, wallVisibility } from "./walls-geometry";

export type SeatView = { tableId: string; nonce: number };
/** Kamera düğmeleri (tuvalin dışında, `Plan3D` içinde) bu komutu üretir; nonce değişince uygulanır. */
export type CameraCommand = { type: "overview" | "stage" | "loca" | "top" | OrbitMove; nonce: number };
export type HoverInfo = { table: SceneTable; x: number; y: number };

export type SceneProps = {
  stillView?: { pose: CameraPose; label: string };
  scene: SceneData;
  canvas: { width: number; height: number };
  activeTableId: string | null;
  artworkUrl?: string | null;
  title?: string;
  seatView?: SeatView | null;
  onTable?(tableId: string): void;
  onSeat?(tableId: string, seatNo: number): void;
  onHoverTable?: (info: HoverInfo | null) => void;
  onContextLost?: () => void;
  onReady?: () => void;
  onCameraChange?: (tag: string) => void;
  describedBy?: string;
  command?: CameraCommand | null;
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
        {isStage ? (
          <mesh position={[0, h / 2 + 0.02, 0]}>
            <boxGeometry args={[Math.max(0.1, width - 0.13), 0.05, Math.max(0.1, depth - 0.13)]} />
            <meshStandardMaterial color={BALLROOM.stage} roughness={0.72} metalness={0.08} />
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
  onHoverTable,
}: {
  tables: readonly SceneTable[];
  onTable?: (tableId: string) => void;
  onHoverTable?: (info: HoverInfo | null) => void;
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
      roundRef.current.computeBoundingSphere();
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
      boxRef.current.computeBoundingSphere();
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
    onPointerMove: (e: { instanceId?: number; nativeEvent: PointerEvent }) => {
      if (e.instanceId === undefined) return;
      const t = list[e.instanceId];
      if (!t) return;
      document.body.style.cursor = t.selectable ? "pointer" : "not-allowed";
      onHoverTable?.({ table: t, x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
    },
    onPointerOut: () => {
      document.body.style.cursor = "";
      onHoverTable?.(null);
    },
  });

  return (
    <group>
      {roundTables.length > 0 ? (
        <instancedMesh ref={roundRef} frustumCulled={false} key={`r-${roundTables.length}`} args={[undefined, undefined, roundTables.length]} {...handle(roundTables)}>
          <cylinderGeometry args={[0.5, 0.45, 1, 24]} />
          <meshStandardMaterial attach="material-0" color={BALLROOM.tableWhite} roughness={0.81} />
          <meshBasicMaterial attach="material-1" toneMapped={false} />
          <meshStandardMaterial attach="material-2" color={BALLROOM.tableWhite} roughness={0.81} />
        </instancedMesh>
      ) : null}
      {boxTables.length > 0 ? (
        <instancedMesh ref={boxRef} frustumCulled={false} key={`b-${boxTables.length}`} args={[undefined, undefined, boxTables.length]} {...handle(boxTables)}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
      ) : null}
      {tables
        .filter((t) => t.picked || t.active)
        .map((t) => {
          const isBox = t.isLoca || t.shape !== "round";
          return (
            <group key={t.key} position={[t.x, t.floorY, t.z]}>
              <mesh
                position={[0, 0.035, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                scale={isBox ? [1.88, 1.4, 1] : [1, 1, 1]}
              >
                <ringGeometry args={[1.36, 1.52, 48]} />
                <meshBasicMaterial color={BALLROOM.ring} transparent opacity={0.92} side={DoubleSide} toneMapped={false} />
              </mesh>
              <mesh position={[0, 0.4, 0]} scale={[t.width * 0.56, 0.8, t.depth * 0.56]}>
                <cylinderGeometry args={[1, 1.02, 1, 24, 1, true]} />
                <meshBasicMaterial color={BALLROOM.bodyGlow} transparent opacity={0.45} side={DoubleSide} depthWrite={false} />
              </mesh>
            </group>
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
  seatView,
  command,
  orbitRef,
  onPoseDone,
  onPovChange,
  onCamPos,
}: {
  scene: SceneData;
  seatView?: SeatView | null;
  command: CameraCommand | null;
  orbitRef: React.RefObject<OrbitHandle | null>;
  onPoseDone: (tag: string) => void;
  onPovChange: (pov: boolean) => void;
  onCamPos: (pos: Vec3) => void;
}) {
  const { get, size, invalidate } = useThree();
  const flightRef = useRef<Flight | null>(null);
  const narrow = size.height > 0 ? size.width / size.height < 1.15 : false;
  const maxDist = maxDistance(scene.room);

  const startFlight = useCallback(
    (to: CameraPose, tag: string, duration = 580) => {
      const cam = get().camera;
      const ctrl = orbitRef.current;
      const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reducedMotion) {
        flightRef.current = null;
        cam.position.set(...to.position);
        ctrl?.target.set(...to.target);
        if (cam instanceof PerspectiveCamera) {
          cam.fov = to.fov;
          cam.updateProjectionMatrix();
        }
        ctrl?.update();
        onPovChange(tag.startsWith("seat:"));
        onCamPos(to.position);
        onPoseDone(tag);
        invalidate();
        return;
      }
      const curTarget: Vec3 = ctrl ? [ctrl.target.x, ctrl.target.y, ctrl.target.z] : [0, 1, 1];
      const fov = cam instanceof PerspectiveCamera ? cam.fov : FOV_HALL;
      flightRef.current = {
        fromPos: [cam.position.x, cam.position.y, cam.position.z],
        fromTarget: curTarget,
        fromFov: fov,
        to,
        tag,
        startedAt: performance.now(),
        duration,
      };
      onPovChange(tag.startsWith("seat:"));
      invalidate();
    },
    [get, orbitRef, onPovChange, onCamPos, onPoseDone, invalidate],
  );

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
    if (command.type === "stage") {
      startFlight(stagePose(scene.room, scene.stage), "stage");
      return;
    }
    if (command.type === "loca") {
      startFlight(locaPose(scene.room, scene.stage), "loca");
      return;
    }
    if (command.type === "top") {
      startFlight(topPose(scene.room, narrow), "top");
      return;
    }
    const cam = get().camera;
    const ctrl = orbitRef.current;
    const curTarget: Vec3 = ctrl ? [ctrl.target.x, ctrl.target.y, ctrl.target.z] : [0, 1, 1];
    const fov = cam instanceof PerspectiveCamera ? cam.fov : FOV_HALL;
    const next = orbitMove(
      { position: [cam.position.x, cam.position.y, cam.position.z], target: curTarget },
      command.type,
      maxDist,
    );
    startFlight({ ...next, fov }, "free", 330);
  }, [command, scene.room, scene.stage, narrow, maxDist, get, orbitRef, startFlight]);

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

  useFrame((state) => {
    const f = flightRef.current;
    if (!f) return;
    const cam = state.camera;
    const elapsed = performance.now() - f.startedAt;
    const raw = Math.min(1, elapsed / f.duration);
    const t = raw * raw * (3 - 2 * raw);

    const px = f.fromPos[0] + (f.to.position[0] - f.fromPos[0]) * t;
    const py = f.fromPos[1] + (f.to.position[1] - f.fromPos[1]) * t;
    const pz = f.fromPos[2] + (f.to.position[2] - f.fromPos[2]) * t;
    cam.position.set(px, py, pz);

    const tx = f.fromTarget[0] + (f.to.target[0] - f.fromTarget[0]) * t;
    const ty = f.fromTarget[1] + (f.to.target[1] - f.fromTarget[1]) * t;
    const tz = f.fromTarget[2] + (f.to.target[2] - f.fromTarget[2]) * t;
    orbitRef.current?.target.set(tx, ty, tz);

    if (cam instanceof PerspectiveCamera) {
      cam.fov = f.fromFov + (f.to.fov - f.fromFov) * t;
      cam.updateProjectionMatrix();
    }
    orbitRef.current?.update();

    if (raw >= 1) {
      const doneTag = f.tag;
      const finalPos = f.to.position;
      flightRef.current = null;
      onCamPos(finalPos);
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
  onHoverTable,
  onContextLost,
  onReady,
  onCameraChange,
  describedBy,
  command = null,
  stillView,
}: SceneProps) {
  const orbitRef = useRef<OrbitHandle | null>(null);
  const initialPose = useMemo(() => stillView?.pose ?? overviewPose(scene.room, false), [stillView, scene.room]);
  const [camPos, setCamPos] = useState<Vec3>(initialPose.position);
  const [pov, setPov] = useState(Boolean(stillView));

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

  const wallVis = useMemo(() => wallVisibility(scene.room, camPos, pov), [scene.room, camPos, pov]);

  return (
    <div className="relative h-full w-full bg-bg">
      <div role="img" aria-label={stillView?.label ?? "Salon planı (3B)"} aria-describedby={describedBy} className="h-full w-full">
        <Canvas
          frameloop="demand"
          dpr={[1, 1.65]}
          camera={{ position: initialPose.position, fov: initialPose.fov }}
          gl={{ antialias: true, powerPreference: "low-power", toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
          style={{ touchAction: "pan-y" }}
          onCreated={({ camera }) => {
            if (stillView) camera.lookAt(...stillView.pose.target);
            onReady?.();
            onCameraChange?.("overview");
          }}
        >
          <ContextLossGuard onLost={onContextLost} />
          <color attach="background" args={[BALLROOM.background]} />
          <fogExp2 attach="fog" args={[BALLROOM.background, 0.0055]} />
          <BallroomLights />
          <BallroomFloor width={scene.room.width} depth={scene.room.depth} />
          <Chandeliers width={scene.room.width} height={WALL_HEIGHT + 2.5} visible />
          {scene.decor.map((e) => (
            <DecorMesh key={e.id} element={e} />
          ))}
          <StageRig stage={scene.stage} />
          <StageScreen stage={scene.stage} room={scene.room} artworkUrl={artworkUrl} title={title} wallVis={wallVis} />
          <LocaArchitecture tables={scene.tables} />
          <SceneLines lines={scene.lines} />
          <InstancedTables tables={scene.tables} onTable={onTable} onHoverTable={onHoverTable} />
          <Chairs
            chairs={scene.chairs}
            onClick={handleChairClick}
            onPointerOver={handleChairHover}
            onPointerOut={() => {
              document.body.style.cursor = "";
            }}
          />
          {!stillView && <TableLabels tables={scene.tables} />}
          <SeatLabels chairs={activeChairs} visible={nearActive} />
          <SceneWalls
            canvasWidth={canvas.width}
            canvasHeight={canvas.height}
            room={scene.room}
            cameraPosition={camPos}
            pov={pov}
          />
          {!stillView && (
            <>
              <OrbitControls
                ref={orbitRef as never}
                makeDefault
                enableDamping
                dampingFactor={0.05}
                enablePan
                screenSpacePanning={false}
                panSpeed={0.9}
                target={initialPose.target}
                minDistance={MIN_DISTANCE}
                maxDistance={maxDistance(scene.room)}
                maxPolarAngle={Math.PI / 2 - 0.012}
                onEnd={(e) => {
                  const cam = (e?.target as { object?: PerspectiveCamera } | undefined)?.object;
                  if (cam) setCamPos([cam.position.x, cam.position.y, cam.position.z]);
                }}
              />
              <CameraController
                scene={scene}
                seatView={seatView}
                command={command}
                orbitRef={orbitRef}
                onPoseDone={(tag) => onCameraChange?.(tag)}
                onPovChange={setPov}
                onCamPos={setCamPos}
              />
            </>
          )}
        </Canvas>
      </div>
    </div>
  );
}
