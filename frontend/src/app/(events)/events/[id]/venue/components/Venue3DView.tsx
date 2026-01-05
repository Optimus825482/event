"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  Environment,
  Text,
  RoundedBox,
  Plane,
} from "@react-three/drei";
import type { PlacedTable, StageElement } from "../types";
import { TABLE_TYPE_CONFIG, CANVAS_WIDTH, CANVAS_HEIGHT } from "../constants";

interface Venue3DViewProps {
  placedTables: PlacedTable[];
  stageElements: StageElement[];
  onClose: () => void;
}

// Kat yüksekliği (her kat 4 birim yükseklikte)
const FLOOR_HEIGHT = 4;

// 2D koordinatları 3D'ye dönüştür
const scale2Dto3D = (
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number
) => {
  const x3d = (x - canvasWidth / 2) / 50;
  const z3d = (y - canvasHeight / 2) / 50;
  return { x: x3d, z: z3d };
};

// Balkon korkuluğu - sadece ön kenar (tavan yok!)
function BalconyRailing({
  floor,
  width,
  height,
}: {
  floor: number;
  width: number;
  height: number;
}) {
  if (floor <= 1) return null;

  const y = (floor - 1) * FLOOR_HEIGHT;
  const w = width / 50;
  const h = height / 50;

  return (
    <group position={[0, y, 0]}>
      {/* Sadece ön korkuluk - ince çizgi */}
      <mesh position={[0, 0.4, h / 2 + 0.3]}>
        <boxGeometry args={[w + 0.5, 0.08, 0.04]} />
        <meshStandardMaterial color="#f472b6" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Korkuluk direkleri */}
      {[-w / 2, -w / 4, 0, w / 4, w / 2].map((xPos, i) => (
        <mesh key={i} position={[xPos, 0.2, h / 2 + 0.3]}>
          <cylinderGeometry args={[0.02, 0.02, 0.4, 8]} />
          <meshStandardMaterial
            color="#94a3b8"
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
      ))}
      {/* Kat etiketi - korkuluk üstünde */}
      <Text
        position={[w / 2 + 0.5, 0.5, h / 2 + 0.3]}
        fontSize={0.3}
        color="#f472b6"
        anchorX="left"
        anchorY="middle"
      >
        {floor}. Kat
      </Text>
    </group>
  );
}

// Masa bileşeni
function Table3D({
  table,
  canvasWidth,
  canvasHeight,
}: {
  table: PlacedTable;
  canvasWidth: number;
  canvasHeight: number;
}) {
  const config = TABLE_TYPE_CONFIG[table.type];
  const size = (table.size || 40) / 50;
  const { x, z } = scale2Dto3D(
    table.x + (table.size || 40) / 2,
    table.y + (table.size || 40) / 2,
    canvasWidth,
    canvasHeight
  );

  // Kat yüksekliği hesapla
  const floor = table.floor || 1;
  const floorY = (floor - 1) * FLOOR_HEIGHT;

  // Loca = Kare, Masa = Silindir
  if (table.isLoca) {
    return (
      <group position={[x, floorY + 0.3, z]}>
        {/* Loca için destek ayağı (2+ kat için) */}
        {floor > 1 && (
          <mesh position={[0, -floorY / 2 - 0.15, 0]}>
            <cylinderGeometry args={[0.08, 0.12, floorY, 8]} />
            <meshStandardMaterial
              color="#475569"
              metalness={0.5}
              roughness={0.5}
            />
          </mesh>
        )}
        {/* Loca gövdesi */}
        <RoundedBox args={[size * 1.5, 0.6, size * 1.5]} radius={0.05}>
          <meshStandardMaterial
            color={config.color}
            metalness={0.3}
            roughness={0.7}
          />
        </RoundedBox>
        {/* Loca üst yüzey */}
        <mesh position={[0, 0.31, 0]}>
          <boxGeometry args={[size * 1.4, 0.02, size * 1.4]} />
          <meshStandardMaterial
            color="#1a1a2e"
            metalness={0.5}
            roughness={0.3}
          />
        </mesh>
        {/* Loca ismi */}
        <Text
          position={[0, 0.65, 0]}
          fontSize={0.2}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {table.locaName || `L${table.tableNumber - 999}`}
        </Text>
      </group>
    );
  }

  return (
    <group position={[x, floorY + 0.25, z]}>
      {/* Masa ayağı */}
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.1, 0.15, 0.2, 16]} />
        <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Masa üstü */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[size / 2, size / 2, 0.08, 32]} />
        <meshStandardMaterial
          color={config.color}
          metalness={0.3}
          roughness={0.6}
        />
      </mesh>
      {/* Masa numarası */}
      <Text
        position={[0, 0.15, 0]}
        fontSize={0.15}
        color="white"
        anchorX="center"
        anchorY="middle"
        rotation={[-Math.PI / 2, 0, 0]}
      >
        {table.tableNumber.toString()}
      </Text>
    </group>
  );
}

// Sahne/Alan bileşeni
function Stage3D({
  stage,
  canvasWidth,
  canvasHeight,
}: {
  stage: StageElement;
  canvasWidth: number;
  canvasHeight: number;
}) {
  const width = stage.width / 50;
  const depth = stage.height / 50;
  const { x, z } = scale2Dto3D(
    stage.x + stage.width / 2,
    stage.y + stage.height / 2,
    canvasWidth,
    canvasHeight
  );

  const isStage = stage.type === "stage";
  const height = isStage ? 0.8 : 0.1;
  const color = stage.color || (isStage ? "#dc2626" : "#3b82f6");

  return (
    <group position={[x, height / 2, z]}>
      <RoundedBox args={[width, height, depth]} radius={0.05}>
        <meshStandardMaterial
          color={color}
          metalness={isStage ? 0.4 : 0.2}
          roughness={isStage ? 0.3 : 0.8}
        />
      </RoundedBox>
      {isStage && (
        <mesh position={[0, height / 2 + 0.02, 0]}>
          <boxGeometry args={[width - 0.1, 0.04, depth - 0.1]} />
          <meshStandardMaterial
            color="#1a1a2e"
            metalness={0.6}
            roughness={0.2}
          />
        </mesh>
      )}
      {/* Sadece displayText varsa göster - default label'ları gösterme */}
      {stage.displayText && stage.displayText.trim() && (
        <Text
          position={[0, height / 2 + 0.2, 0]}
          fontSize={0.25}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {stage.displayText}
        </Text>
      )}
    </group>
  );
}

// Zemin
function Floor({ width, height }: { width: number; height: number }) {
  return (
    <Plane
      args={[width / 50 + 2, height / 50 + 2]}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.01, 0]}
      receiveShadow
    >
      <meshStandardMaterial color="#1e293b" metalness={0.1} roughness={0.9} />
    </Plane>
  );
}

// Grid
function GridLines({ width, height }: { width: number; height: number }) {
  const w = width / 50;
  const h = height / 50;
  return (
    <gridHelper
      args={[Math.max(w, h) + 2, 20, "#334155", "#1e293b"]}
      position={[0, 0.001, 0]}
    />
  );
}

// Kamera kontrolü
function CameraController() {
  return (
    <OrbitControls
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      minDistance={5}
      maxDistance={50}
      maxPolarAngle={Math.PI / 2 - 0.1}
      target={[0, 0, 0]}
    />
  );
}

// Ana sahne
function Scene({
  placedTables,
  stageElements,
}: {
  placedTables: PlacedTable[];
  stageElements: StageElement[];
}) {
  // Kullanılan katları bul
  const usedFloors = [...new Set(placedTables.map((t) => t.floor || 1))].sort();

  return (
    <>
      <PerspectiveCamera makeDefault position={[15, 12, 15]} fov={50} />
      <CameraController />

      {/* Işıklandırma */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[-10, 10, -10]} intensity={0.5} color="#60a5fa" />
      <pointLight position={[10, 10, 10]} intensity={0.3} color="#f472b6" />

      {/* Zemin ve grid */}
      <Floor width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
      <GridLines width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />

      {/* Balkon korkulukları (tavan yok!) */}
      {usedFloors
        .filter((f) => f > 1)
        .map((floor) => (
          <BalconyRailing
            key={floor}
            floor={floor}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
          />
        ))}

      {/* Sahne elementleri */}
      {stageElements.map((stage) => (
        <Stage3D
          key={stage.id}
          stage={stage}
          canvasWidth={CANVAS_WIDTH}
          canvasHeight={CANVAS_HEIGHT}
        />
      ))}

      {/* Masalar */}
      {placedTables.map((table) => (
        <Table3D
          key={table.id}
          table={table}
          canvasWidth={CANVAS_WIDTH}
          canvasHeight={CANVAS_HEIGHT}
        />
      ))}

      {/* Ortam */}
      <Environment preset="city" />

      {/* Sis efekti */}
      <fog attach="fog" args={["#0f172a", 25, 70]} />
    </>
  );
}

// Loading
function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#3b82f6" wireframe />
    </mesh>
  );
}

export function Venue3DView({
  placedTables,
  stageElements,
  onClose,
}: Venue3DViewProps) {
  // Kat istatistikleri
  const floorStats = placedTables.reduce((acc, t) => {
    const floor = t.floor || 1;
    acc[floor] = (acc[floor] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const floorInfo = Object.entries(floorStats)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([floor, count]) => `${floor}. kat: ${count}`)
    .join(" • ");

  return (
    <div className="fixed inset-0 z-50 bg-slate-900">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-slate-800/90 backdrop-blur border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="text-lg font-semibold text-white">3D Görünüm</h2>
          <span className="text-sm text-slate-400">
            {placedTables.length} masa • {stageElements.length} sahne/alan
          </span>
          {Object.keys(floorStats).length > 1 && (
            <span className="text-xs text-pink-400 bg-pink-500/10 px-2 py-1 rounded">
              {floorInfo}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
        >
          Kapat
        </button>
      </div>

      {/* 3D Canvas */}
      <Canvas
        shadows
        gl={{ antialias: true, alpha: false }}
        style={{ background: "#0f172a" }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <Scene placedTables={placedTables} stageElements={stageElements} />
        </Suspense>
      </Canvas>

      {/* Kontrol bilgisi */}
      <div className="absolute bottom-4 left-4 z-10 text-xs text-slate-400 bg-slate-800/80 backdrop-blur px-3 py-2 rounded-lg">
        <p>🖱️ Sol tık + sürükle: Döndür</p>
        <p>🖱️ Sağ tık + sürükle: Kaydır</p>
        <p>🖱️ Scroll: Yakınlaştır/Uzaklaştır</p>
      </div>

      {/* Kat bilgisi */}
      {Object.keys(floorStats).length > 1 && (
        <div className="absolute bottom-4 right-4 z-10 text-xs bg-slate-800/80 backdrop-blur px-3 py-2 rounded-lg">
          <p className="text-slate-300 font-medium mb-1">Katlar:</p>
          {Object.entries(floorStats)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([floor, count]) => (
              <p key={floor} className="text-slate-400">
                <span
                  className={
                    Number(floor) > 1 ? "text-pink-400" : "text-blue-400"
                  }
                >
                  {floor}. Kat:
                </span>{" "}
                {count} {Number(floor) > 1 ? "loca" : "masa"}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
