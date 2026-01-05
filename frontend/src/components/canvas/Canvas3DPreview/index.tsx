"use client";

import {
  Suspense,
  useMemo,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  Text,
  Html,
  Line,
  useTexture,
} from "@react-three/drei";
import {
  Loader2,
  Home,
  X,
  MousePointer,
  Move,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Camera,
  MousePointerClick,
  Users,
  Navigation,
  MapPin,
} from "lucide-react";
import { VenueLayout, CanvasTable, Zone } from "@/types";
import * as THREE from "three";

// ServicePoint tipi
interface ServicePoint {
  id: string;
  name: string;
  pointType: string;
  x: number;
  y: number;
  color: string;
  requiredStaffCount: number;
  assignedStaffCount?: number;
  staffAssignments?: any[];
}

// TableGroup tipi
interface TableGroup {
  id: string;
  name: string;
  color: string;
  tableIds: string[];
  assignedTeamId?: string;
  staffAssignments?: Array<{
    id: string;
    staffId: string;
    staffName?: string;
    role: string;
  }>;
}

// TeamDefinition tipi
interface TeamDefinition {
  id: string;
  name: string;
  color: string;
  assignedGroupIds: string[];
}

// Görüntüleme modu
type ViewMode = "step1" | "step2" | "default";

const SCALE = 0.01;
const TABLE_RADIUS = 0.12;

// ==================== GLASS WALL WITH LOGO ====================
function GlassWall({
  position,
  rotation,
  width,
  height,
  logoUrl,
  showLogo = true,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  width: number;
  height: number;
  logoUrl?: string;
  showLogo?: boolean;
}) {
  const wallHeight = 4;
  const wallY = wallHeight / 2;

  return (
    <group position={position} rotation={rotation}>
      {/* Ana cam duvar - şeffaf */}
      <mesh position={[0, wallY, 0]}>
        <planeGeometry args={[width, wallHeight]} />
        <meshPhysicalMaterial
          color="#1a365d"
          transparent
          opacity={0.15}
          roughness={0.1}
          metalness={0.1}
          clearcoat={1}
          clearcoatRoughness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Altın çerçeve - alt */}
      <mesh position={[0, 0.025, 0.01]}>
        <boxGeometry args={[width, 0.05, 0.02]} />
        <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Altın çerçeve - üst */}
      <mesh position={[0, wallHeight, 0.01]}>
        <boxGeometry args={[width, 0.05, 0.02]} />
        <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Altın çerçeve - sol */}
      <mesh position={[-width / 2, wallY, 0.01]}>
        <boxGeometry args={[0.05, wallHeight, 0.02]} />
        <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Altın çerçeve - sağ */}
      <mesh position={[width / 2, wallY, 0.01]}>
        <boxGeometry args={[0.05, wallHeight, 0.02]} />
        <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Dekoratif ışık şeridi - alt */}
      <mesh position={[0, 0.1, 0.02]}>
        <boxGeometry args={[width - 0.1, 0.02, 0.01]} />
        <meshBasicMaterial color="#ffd700" />
      </mesh>

      {/* Dekoratif ışık şeridi - üst */}
      <mesh position={[0, wallHeight - 0.1, 0.02]}>
        <boxGeometry args={[width - 0.1, 0.02, 0.01]} />
        <meshBasicMaterial color="#ffd700" />
      </mesh>

      {/* Logo alanı - ortada */}
      {showLogo && logoUrl && (
        <Suspense fallback={null}>
          <LogoPlane url={logoUrl} position={[0, wallY, 0.03]} scale={1.5} />
        </Suspense>
      )}
    </group>
  );
}

// ==================== LOGO PLANE ====================
function LogoPlane({
  url,
  position,
  scale = 1,
}: {
  url: string;
  position: [number, number, number];
  scale?: number;
}) {
  const texture = useTexture(url);

  return (
    <mesh position={position}>
      <planeGeometry args={[1.5 * scale, 1.5 * scale]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.9}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ==================== VENUE WALLS ====================
function VenueWalls({
  width,
  height,
  centerX,
  centerZ,
}: {
  width: number;
  height: number;
  centerX: number;
  centerZ: number;
}) {
  const wallDistance = 1.5; // Duvarların masalardan uzaklığı
  const wallWidth = width + wallDistance * 2;
  const wallDepth = height + wallDistance * 2;

  return (
    <group>
      {/* Arka duvar - Merit Royal logosu */}
      <GlassWall
        position={[centerX, 0, centerZ - height / 2 - wallDistance]}
        rotation={[0, 0, 0]}
        width={wallWidth}
        height={4}
        logoUrl="/images/merit-royal-logo.png"
        showLogo={true}
      />

      {/* Sol duvar - Merit International logosu */}
      <GlassWall
        position={[centerX - width / 2 - wallDistance, 0, centerZ]}
        rotation={[0, Math.PI / 2, 0]}
        width={wallDepth}
        height={4}
        logoUrl="/images/merit-international-logo.png"
        showLogo={true}
      />

      {/* Sağ duvar - Merit International logosu */}
      <GlassWall
        position={[centerX + width / 2 + wallDistance, 0, centerZ]}
        rotation={[0, -Math.PI / 2, 0]}
        width={wallDepth}
        height={4}
        logoUrl="/images/merit-international-logo.png"
        showLogo={true}
      />

      {/* Köşe kolonları - altın */}
      <CornerPillar
        position={[
          centerX - width / 2 - wallDistance,
          0,
          centerZ - height / 2 - wallDistance,
        ]}
      />
      <CornerPillar
        position={[
          centerX + width / 2 + wallDistance,
          0,
          centerZ - height / 2 - wallDistance,
        ]}
      />
      <CornerPillar
        position={[
          centerX - width / 2 - wallDistance,
          0,
          centerZ + height / 2 + wallDistance,
        ]}
      />
      <CornerPillar
        position={[
          centerX + width / 2 + wallDistance,
          0,
          centerZ + height / 2 + wallDistance,
        ]}
      />

      {/* Zemin ışık şeritleri */}
      <FloorLightStrip
        start={[
          centerX - width / 2 - wallDistance,
          0.01,
          centerZ - height / 2 - wallDistance,
        ]}
        end={[
          centerX + width / 2 + wallDistance,
          0.01,
          centerZ - height / 2 - wallDistance,
        ]}
      />
      <FloorLightStrip
        start={[
          centerX - width / 2 - wallDistance,
          0.01,
          centerZ - height / 2 - wallDistance,
        ]}
        end={[
          centerX - width / 2 - wallDistance,
          0.01,
          centerZ + height / 2 + wallDistance,
        ]}
      />
      <FloorLightStrip
        start={[
          centerX + width / 2 + wallDistance,
          0.01,
          centerZ - height / 2 - wallDistance,
        ]}
        end={[
          centerX + width / 2 + wallDistance,
          0.01,
          centerZ + height / 2 + wallDistance,
        ]}
      />
    </group>
  );
}

// ==================== CORNER PILLAR ====================
function CornerPillar({ position }: { position: [number, number, number] }) {
  const pillarHeight = 4.2;

  return (
    <group position={position}>
      {/* Ana kolon */}
      <mesh position={[0, pillarHeight / 2, 0]}>
        <cylinderGeometry args={[0.08, 0.1, pillarHeight, 16]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Taban */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
        <meshStandardMaterial color="#b8860b" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Üst başlık */}
      <mesh position={[0, pillarHeight, 0]}>
        <cylinderGeometry args={[0.12, 0.08, 0.15, 16]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Işık topu - üstte */}
      <mesh position={[0, pillarHeight + 0.15, 0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color="#ffd700" />
      </mesh>
      <pointLight
        position={[0, pillarHeight + 0.15, 0]}
        color="#ffd700"
        intensity={0.3}
        distance={3}
      />
    </group>
  );
}

// ==================== FLOOR LIGHT STRIP ====================
function FloorLightStrip({
  start,
  end,
}: {
  start: [number, number, number];
  end: [number, number, number];
}) {
  return (
    <Line
      points={[start, end]}
      color="#d4af37"
      lineWidth={3}
      transparent
      opacity={0.8}
    />
  );
}

// ==================== SECOND FLOOR BALCONY ====================
// Localar için ARKA DUVARA yaslanmış balkon
function SecondFloorPlatform({
  tables,
  scale,
  centerX,
  centerZ,
}: {
  tables: CanvasTable[];
  scale: number;
  centerX: number;
  centerZ: number;
}) {
  // 2. kattaki masaları bul (floor=2 veya loca label'ı olanlar)
  const secondFloorTables = useMemo(() => {
    return tables.filter((t) => {
      const isLoca =
        t.label?.toUpperCase().startsWith("L") ||
        t.typeName?.toLowerCase().includes("loca");
      return t.floor === 2 || isLoca;
    });
  }, [tables]);

  // 2. katta masa yoksa balkon gösterme
  if (secondFloorTables.length === 0) return null;

  // Sadece NORMAL masaların (loca olmayanların) sınırlarını hesapla
  const venueBounds = useMemo(() => {
    const normalTables = tables.filter((t) => {
      const isLoca =
        t.label?.toUpperCase().startsWith("L") ||
        t.typeName?.toLowerCase().includes("loca") ||
        t.floor === 2;
      return !isLoca;
    });

    if (normalTables.length === 0) return null;

    let minX = Infinity,
      maxX = -Infinity;
    let minZ = Infinity,
      maxZ = -Infinity;
    normalTables.forEach((t) => {
      const x = t.x * scale;
      const z = t.y * scale;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    });
    return { minX, maxX, minZ, maxZ };
  }, [tables, scale]);

  if (!venueBounds) return null;

  const FLOOR_HEIGHT = 1.8; // Balkon yüksekliği
  const RAILING_HEIGHT = 0.4; // Korkuluk yüksekliği
  const BALCONY_DEPTH = 1.4; // Balkon derinliği
  const WALL_DISTANCE = 2.5; // Duvarların masalardan uzaklığı - ARTIRILDI

  // Balkon genişliği: Sadece loca sayısına göre hesapla
  const locaCount = secondFloorTables.length;
  const LOCA_WIDTH = 0.65; // Her loca booth genişliği
  const LOCA_GAP = 0.25; // Localar arası boşluk
  // Balkon genişliği = loca sayısı * (loca genişliği + boşluk) + kenar payları
  const balconyWidth = Math.max(locaCount * (LOCA_WIDTH + LOCA_GAP) + 0.4, 2.5);

  // Balkon X pozisyonu: Venue'nun ortasında + sağa offset
  const venueWidth = venueBounds.maxX - venueBounds.minX;
  const balconyX = venueBounds.minX + venueWidth / 2 - 0.6; // Sağa kaydırıldı (azaltıldı)

  // Balkon Z pozisyonu: ARKA DUVARA yaslanıyor (maxZ tarafı - sahnenin KARŞISI)
  const backWallZ = venueBounds.maxZ + WALL_DISTANCE;
  const balconyZ = backWallZ - BALCONY_DEPTH / 2;

  return (
    <group>
      {/* Balkon - 180° döndürülmüş, localar sahneye bakıyor */}
      <group position={[balconyX, 0, balconyZ]} rotation={[0, Math.PI, 0]}>
        {/* ==================== BALKON ZEMİNİ ==================== */}
        <mesh position={[0, FLOOR_HEIGHT - 0.05, 0]} receiveShadow castShadow>
          <boxGeometry args={[balconyWidth, 0.15, BALCONY_DEPTH]} />
          <meshStandardMaterial
            color="#1a1a2e"
            metalness={0.3}
            roughness={0.7}
          />
        </mesh>

        {/* Zemin üst yüzey - şık parke görünümü */}
        <mesh position={[0, FLOOR_HEIGHT + 0.01, 0]} receiveShadow>
          <boxGeometry args={[balconyWidth - 0.1, 0.02, BALCONY_DEPTH - 0.1]} />
          <meshStandardMaterial
            color="#2d2d44"
            metalness={0.1}
            roughness={0.9}
          />
        </mesh>

        {/* ==================== CAM KORKULUK (ÖN TARAF - salona bakan) ==================== */}
        <mesh
          position={[
            0,
            FLOOR_HEIGHT + RAILING_HEIGHT / 2,
            -BALCONY_DEPTH / 2 + 0.02,
          ]}
        >
          <boxGeometry args={[balconyWidth - 0.2, RAILING_HEIGHT, 0.03]} />
          <meshPhysicalMaterial
            color="#88ccff"
            transparent
            opacity={0.25}
            roughness={0.05}
            metalness={0.1}
            clearcoat={1}
          />
        </mesh>

        {/* Korkuluk üst tutamak - altın */}
        <mesh
          position={[
            0,
            FLOOR_HEIGHT + RAILING_HEIGHT,
            -BALCONY_DEPTH / 2 + 0.05,
          ]}
        >
          <boxGeometry args={[balconyWidth, 0.06, 0.08]} />
          <meshStandardMaterial
            color="#d4af37"
            metalness={0.85}
            roughness={0.15}
          />
        </mesh>

        {/* Korkuluk alt çerçeve - altın */}
        <mesh position={[0, FLOOR_HEIGHT + 0.03, -BALCONY_DEPTH / 2 + 0.05]}>
          <boxGeometry args={[balconyWidth, 0.04, 0.06]} />
          <meshStandardMaterial
            color="#d4af37"
            metalness={0.85}
            roughness={0.15}
          />
        </mesh>

        {/* ==================== YAN KORKULUKLAR ==================== */}
        <mesh
          position={[
            -balconyWidth / 2 + 0.05,
            FLOOR_HEIGHT + RAILING_HEIGHT / 2,
            0,
          ]}
        >
          <boxGeometry args={[0.03, RAILING_HEIGHT, BALCONY_DEPTH - 0.2]} />
          <meshPhysicalMaterial
            color="#88ccff"
            transparent
            opacity={0.25}
            roughness={0.05}
            metalness={0.1}
            clearcoat={1}
          />
        </mesh>
        <mesh
          position={[
            balconyWidth / 2 - 0.05,
            FLOOR_HEIGHT + RAILING_HEIGHT / 2,
            0,
          ]}
        >
          <boxGeometry args={[0.03, RAILING_HEIGHT, BALCONY_DEPTH - 0.2]} />
          <meshPhysicalMaterial
            color="#88ccff"
            transparent
            opacity={0.25}
            roughness={0.05}
            metalness={0.1}
            clearcoat={1}
          />
        </mesh>

        {/* ==================== AYDINLATMA ==================== */}
        <mesh position={[0, FLOOR_HEIGHT - 0.2, -BALCONY_DEPTH / 2 + 0.1]}>
          <boxGeometry args={[balconyWidth - 0.5, 0.03, 0.03]} />
          <meshBasicMaterial color="#ffd700" />
        </mesh>
        <pointLight
          position={[0, FLOOR_HEIGHT - 0.3, -BALCONY_DEPTH / 2]}
          color="#ffd700"
          intensity={0.4}
          distance={4}
        />
        <pointLight
          position={[-balconyWidth / 3, FLOOR_HEIGHT + 1.5, 0]}
          color="#ffffff"
          intensity={0.3}
          distance={3}
        />
        <pointLight
          position={[balconyWidth / 3, FLOOR_HEIGHT + 1.5, 0]}
          color="#ffffff"
          intensity={0.3}
          distance={3}
        />

        {/* ==================== LOCA ETİKETİ ==================== */}
        <Text
          position={[
            0,
            FLOOR_HEIGHT + RAILING_HEIGHT + 0.2,
            -BALCONY_DEPTH / 2,
          ]}
          fontSize={0.25}
          color="#d4af37"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.015}
          outlineColor="#000000"
        >
          ★ VIP LOCA ★
        </Text>

        {/* ==================== LOCALAR - Balkon içinde yan yana ==================== */}
        {secondFloorTables.map((table, index) => {
          // Locaları balkon içinde ortalanmış şekilde yan yana diz
          const totalWidth = locaCount * (LOCA_WIDTH + LOCA_GAP) - LOCA_GAP;
          const startX = -totalWidth / 2 + LOCA_WIDTH / 2;
          const locaX = startX + index * (LOCA_WIDTH + LOCA_GAP);

          return (
            <group key={table.id} position={[locaX, FLOOR_HEIGHT, 0]}>
              {/* VIP Loca Booth - rotation=0 çünkü balkon zaten 180° döndürülmüş */}
              <group rotation={[0, 0, 0]} position={[0, 0, 0]}>
                {/* ===== BALKON AYIRICI DUVARLAR ===== */}
                <mesh position={[-LOCA_WIDTH / 2 + 0.03, 0.3, 0]} castShadow>
                  <boxGeometry args={[0.06, 0.6, 0.7]} />
                  <meshStandardMaterial
                    color="#0a0a14"
                    metalness={0.4}
                    roughness={0.6}
                  />
                </mesh>
                <mesh position={[LOCA_WIDTH / 2 - 0.03, 0.3, 0]} castShadow>
                  <boxGeometry args={[0.06, 0.6, 0.7]} />
                  <meshStandardMaterial
                    color="#0a0a14"
                    metalness={0.4}
                    roughness={0.6}
                  />
                </mesh>

                {/* ===== BOOTH ARKA DUVAR ===== */}
                <mesh position={[0, 0.3, -0.32]} castShadow>
                  <boxGeometry args={[LOCA_WIDTH - 0.08, 0.6, 0.05]} />
                  <meshStandardMaterial
                    color="#0f172a"
                    metalness={0.3}
                    roughness={0.7}
                  />
                </mesh>

                {/* ===== BOOTH ZEMİN ===== */}
                <mesh position={[0, 0.02, 0]} receiveShadow>
                  <boxGeometry args={[LOCA_WIDTH - 0.08, 0.04, 0.65]} />
                  <meshStandardMaterial
                    color="#1e293b"
                    metalness={0.2}
                    roughness={0.8}
                  />
                </mesh>

                {/* ===== 2'Lİ VIP KANEPE ===== */}
                {/* Kanepe gövdesi */}
                <mesh position={[0, 0.16, -0.15]} castShadow>
                  <boxGeometry args={[LOCA_WIDTH - 0.2, 0.28, 0.16]} />
                  <meshStandardMaterial
                    color="#1a1a2e"
                    metalness={0.4}
                    roughness={0.6}
                  />
                </mesh>
                {/* Kanepe sırtlık */}
                <mesh
                  position={[0, 0.32, -0.22]}
                  rotation={[-0.15, 0, 0]}
                  castShadow
                >
                  <boxGeometry args={[LOCA_WIDTH - 0.24, 0.28, 0.05]} />
                  <meshStandardMaterial
                    color="#0f172a"
                    metalness={0.3}
                    roughness={0.7}
                  />
                </mesh>
                {/* Oturma yeri */}
                <mesh position={[0, 0.22, -0.08]} castShadow>
                  <boxGeometry args={[LOCA_WIDTH - 0.28, 0.06, 0.28]} />
                  <meshStandardMaterial
                    color="#1e3a5f"
                    metalness={0.1}
                    roughness={0.9}
                  />
                </mesh>
                {/* Sol kol dayama */}
                <mesh
                  position={[-(LOCA_WIDTH / 2 - 0.14), 0.2, -0.08]}
                  castShadow
                >
                  <boxGeometry args={[0.08, 0.34, 0.28]} />
                  <meshStandardMaterial
                    color="#1a1a2e"
                    metalness={0.4}
                    roughness={0.6}
                  />
                </mesh>
                {/* Sağ kol dayama */}
                <mesh position={[LOCA_WIDTH / 2 - 0.14, 0.2, -0.08]} castShadow>
                  <boxGeometry args={[0.08, 0.34, 0.28]} />
                  <meshStandardMaterial
                    color="#1a1a2e"
                    metalness={0.4}
                    roughness={0.6}
                  />
                </mesh>

                {/* ===== NEON KENARLAR ===== */}
                <mesh position={[0, 0.58, -0.3]}>
                  <boxGeometry args={[LOCA_WIDTH - 0.08, 0.02, 0.02]} />
                  <meshBasicMaterial color="#22d3ee" />
                </mesh>
                <mesh position={[-(LOCA_WIDTH / 2 - 0.05), 0.3, -0.3]}>
                  <boxGeometry args={[0.02, 0.56, 0.02]} />
                  <meshBasicMaterial color="#22d3ee" />
                </mesh>
                <mesh position={[LOCA_WIDTH / 2 - 0.05, 0.3, -0.3]}>
                  <boxGeometry args={[0.02, 0.56, 0.02]} />
                  <meshBasicMaterial color="#22d3ee" />
                </mesh>
                <mesh position={[0, 0.46, -0.2]}>
                  <boxGeometry args={[LOCA_WIDTH - 0.24, 0.015, 0.015]} />
                  <meshBasicMaterial color="#22d3ee" />
                </mesh>
                {/* Kol neonları */}
                <mesh position={[-(LOCA_WIDTH / 2 - 0.14), 0.38, -0.08]}>
                  <boxGeometry args={[0.09, 0.015, 0.28]} />
                  <meshBasicMaterial color="#22d3ee" />
                </mesh>
                <mesh position={[LOCA_WIDTH / 2 - 0.14, 0.38, -0.08]}>
                  <boxGeometry args={[0.09, 0.015, 0.28]} />
                  <meshBasicMaterial color="#22d3ee" />
                </mesh>

                <pointLight
                  position={[0, 0.4, 0]}
                  color="#22d3ee"
                  intensity={0.3}
                  distance={0.8}
                />
              </group>

              {/* Loca Label - Ön tarafa bakacak şekilde (balkon 180° döndürülmüş) */}
              <Text
                position={[0, 0.7, 0.4]}
                fontSize={0.14}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.012}
                outlineColor="#000000"
              >
                {table.label || `L${index + 1}`}
              </Text>
            </group>
          );
        })}

        {/* Dekoratif kenar ışıkları */}
        <Line
          points={[
            [-balconyWidth / 2, FLOOR_HEIGHT + 0.02, -BALCONY_DEPTH / 2 + 0.1],
            [balconyWidth / 2, FLOOR_HEIGHT + 0.02, -BALCONY_DEPTH / 2 + 0.1],
          ]}
          color="#d4af37"
          lineWidth={2}
          transparent
          opacity={0.8}
        />
      </group>

      {/* ==================== DESTEK KOLONLARI (ÖN TARAFTA - grup dışında) ==================== */}
      <BalconyPillar
        position={[
          balconyX - balconyWidth / 2 + 0.15,
          0,
          balconyZ - BALCONY_DEPTH / 2 + 0.15,
        ]}
        height={FLOOR_HEIGHT}
      />
      <BalconyPillar
        position={[
          balconyX + balconyWidth / 2 - 0.15,
          0,
          balconyZ - BALCONY_DEPTH / 2 + 0.15,
        ]}
        height={FLOOR_HEIGHT}
      />
      {balconyWidth > 3 && (
        <>
          <BalconyPillar
            position={[
              balconyX - balconyWidth / 4,
              0,
              balconyZ - BALCONY_DEPTH / 2 + 0.15,
            ]}
            height={FLOOR_HEIGHT}
          />
          <BalconyPillar
            position={[
              balconyX + balconyWidth / 4,
              0,
              balconyZ - BALCONY_DEPTH / 2 + 0.15,
            ]}
            height={FLOOR_HEIGHT}
          />
        </>
      )}
    </group>
  );
}

// ==================== BALCONY PILLAR ====================
function BalconyPillar({
  position,
  height,
}: {
  position: [number, number, number];
  height: number;
}) {
  return (
    <group position={position}>
      {/* Ana kolon - kare kesit, şık görünüm */}
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[0.12, height, 0.12]} />
        <meshStandardMaterial color="#334155" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* Kolon tabanı */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.18, 0.1, 0.18]} />
        <meshStandardMaterial color="#1e293b" metalness={0.3} roughness={0.7} />
      </mesh>
      {/* Kolon başlığı */}
      <mesh position={[0, height - 0.05, 0]}>
        <boxGeometry args={[0.16, 0.1, 0.16]} />
        <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Dekoratif halka */}
      <mesh position={[0, height * 0.7, 0]}>
        <boxGeometry args={[0.14, 0.04, 0.14]} />
        <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}

// ==================== TABLE MESH ====================
function TableMesh({
  table,
  scale,
  isSelected,
  onSelect,
  group,
  team,
  viewMode,
}: {
  table: CanvasTable;
  scale: number;
  isSelected: boolean;
  onSelect: () => void;
  group?: TableGroup;
  team?: TeamDefinition;
  viewMode: ViewMode;
}) {
  // Loca kontrolü - ÖNCELİKLE tanımlanmalı (diğer hesaplamalarda kullanılıyor)
  const isLoca =
    table.label?.toUpperCase().startsWith("L") ||
    table.typeName?.toLowerCase().includes("loca");

  // Masa pozisyonunu direkt kullan
  // Localar için daha geniş spacing - her loca ayrı balkon bölmesi
  const LOCA_SPACING_MULTIPLIER = 1.8; // Localar arası boşluk için çarpan (artırıldı)
  const x = table.x * scale * (isLoca ? LOCA_SPACING_MULTIPLIER : 1);
  const z = table.y * scale;

  // Kat yüksekliği: floor=2 ise 2. kat (localar), floor=1 veya undefined ise zemin kat
  const floorLevel = table.floor || (isLoca ? 2 : 1);
  const FLOOR_HEIGHT = 1.8; // Balkon yüksekliği - alçaltıldı
  // Balkon zemini FLOOR_HEIGHT - 0.05 pozisyonunda, masalar bunun üstüne oturmalı
  const baseY = floorLevel === 1 ? 0 : FLOOR_HEIGHT;

  // Renk: Grup varsa grup rengi, yoksa masa rengi
  const color = group?.color || table.color || "#3b82f6";

  // Görevli isimleri
  const staffNames =
    group?.staffAssignments?.map((a) => a.staffName || "Personel") || [];

  return (
    <group
      position={[x, baseY, z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Selection indicator ve Info popup */}
      {isSelected && (
        <>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry
              args={[TABLE_RADIUS + 0.06, TABLE_RADIUS + 0.12, 32]}
            />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.8} />
          </mesh>
          <mesh position={[0, 0.8, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.8, 8]} />
            <meshBasicMaterial color="#06b6d4" transparent opacity={0.7} />
          </mesh>
          <mesh position={[0, 1.05, 0]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshBasicMaterial color="#22d3ee" />
          </mesh>

          {/* Grup ve Görevli Bilgisi Popup */}
          {group && (
            <Html position={[0, 1.4, 0]} center distanceFactor={8}>
              <div
                className="bg-slate-900/95 text-white text-xs px-4 py-3 rounded-xl shadow-2xl whitespace-nowrap border-2 pointer-events-none animate-in fade-in zoom-in duration-200 min-w-[160px]"
                style={{ borderColor: group.color }}
              >
                {/* Grup Adı */}
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="font-bold text-sm">{group.name}</span>
                </div>

                {/* Takım Bilgisi */}
                {team && (
                  <div
                    className="mb-2 px-2 py-1.5 rounded-lg"
                    style={{ backgroundColor: `${team.color}20` }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Users
                        className="w-3.5 h-3.5"
                        style={{ color: team.color }}
                      />
                      <span
                        className="font-medium"
                        style={{ color: team.color }}
                      >
                        {team.name}
                      </span>
                    </div>
                  </div>
                )}

                {/* Görevliler */}
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                    Görevliler
                  </p>
                  {staffNames.length > 0 ? (
                    <div className="space-y-1 max-h-20 overflow-y-auto">
                      {staffNames.slice(0, 5).map((name, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded text-[11px]"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          {name}
                        </div>
                      ))}
                      {staffNames.length > 5 && (
                        <div className="text-[10px] text-slate-400 text-center">
                          +{staffNames.length - 5} kişi daha
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">
                      Görevli atanmamış
                    </p>
                  )}
                </div>
              </div>
            </Html>
          )}
        </>
      )}

      {/* LOCA ve Normal Masalar */}
      {isLoca ? null : ( // Localar SecondFloorPlatform içinde render ediliyor - burada skip
        <>
          {/* Normal Masa */}
          <mesh position={[0, 0.38, 0]} castShadow>
            <cylinderGeometry
              args={[TABLE_RADIUS + 0.01, TABLE_RADIUS + 0.02, 0.025, 16]}
            />
            <meshStandardMaterial
              color={color}
              metalness={0.1}
              roughness={0.8}
            />
          </mesh>

          <mesh position={[0, 0.355, 0]} castShadow>
            <cylinderGeometry args={[TABLE_RADIUS, TABLE_RADIUS, 0.03, 16]} />
            <meshStandardMaterial
              color="#f8fafc"
              metalness={0.2}
              roughness={0.5}
            />
          </mesh>

          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.025, 0.035, 0.32, 8]} />
            <meshStandardMaterial
              color="#374151"
              metalness={0.6}
              roughness={0.4}
            />
          </mesh>

          <mesh position={[0, 0.015, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.03, 12]} />
            <meshStandardMaterial
              color="#1f2937"
              metalness={0.5}
              roughness={0.5}
            />
          </mesh>

          <mesh position={[0, 0.395, 0]}>
            <cylinderGeometry args={[0.05, 0.045, 0.006, 12]} />
            <meshStandardMaterial
              color="#ffffff"
              metalness={0.3}
              roughness={0.4}
            />
          </mesh>
        </>
      )}
    </group>
  );
}

// ==================== ZONE MESH ====================
function ZoneMesh({ zone, scale }: { zone: Zone; scale: number }) {
  const x = (zone.x + zone.width / 2) * scale;
  const z = (zone.y + zone.height / 2) * scale;
  const width = zone.width * scale;
  const depth = zone.height * scale;
  const isStage =
    zone.type === "stage" ||
    zone.type === "stage-extension" ||
    zone.type === "system";
  const height = isStage ? 0.3 : 0.05;

  const getColor = () => {
    if (zone.type === "stage") return "#1e3a5f";
    if (zone.type === "stage-extension") return "#334155";
    if (zone.type === "system") return "#78350f";
    return zone.color || "#4c1d95";
  };

  const getLabel = () => {
    if (zone.label) return zone.label;
    if (zone.type === "stage") return "SAHNE";
    if (zone.type === "stage-extension") return "CATWALK";
    if (zone.type === "system") return "SİSTEM KONTROL";
    return "";
  };

  const label = getLabel();

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={getColor()}
          metalness={0.1}
          roughness={0.8}
        />
      </mesh>

      {isStage && (
        <mesh position={[0, height + 0.005, 0]}>
          <boxGeometry args={[width - 0.01, 0.01, depth - 0.01]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
      )}

      {label && (
        <Text
          position={[0, height + 0.08, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={Math.min(width, depth) * 0.15}
          color="#f8fafc"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.005}
          outlineColor="#000000"
        >
          {label}
        </Text>
      )}
    </group>
  );
}

// ==================== SERVICE POINT MESH ====================
function ServicePointMesh({
  servicePoint,
  scale,
  isSelected,
  onSelect,
}: {
  servicePoint: ServicePoint;
  scale: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const x = servicePoint.x * scale;
  const z = servicePoint.y * scale;
  const color = servicePoint.color || "#0625d4ff";
  const assignedCount =
    servicePoint.staffAssignments?.length ||
    servicePoint.assignedStaffCount ||
    0;
  const requiredCount = servicePoint.requiredStaffCount;
  const isComplete = assignedCount >= requiredCount;

  // Hizmet noktası tipi için yükseklik - BÜYÜTÜLDÜ
  const baseHeight = 1.0;
  const counterWidth = 0.7;
  const counterDepth = 0.35;

  return (
    <group
      position={[x, 0, z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Info popup - sadece seçiliyken göster */}
      {isSelected && (
        <Html position={[0, baseHeight + 0.4, 0]} center distanceFactor={10}>
          <div className="bg-slate-800/95 text-white text-xs px-3 py-2 rounded-lg shadow-xl whitespace-nowrap border border-cyan-500/50 pointer-events-none animate-in fade-in zoom-in duration-200">
            <div className="font-semibold text-sm" style={{ color }}>
              {servicePoint.name}
            </div>
            <div className="text-slate-300 mt-0.5 flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>
                {assignedCount}/{requiredCount} Personel
              </span>
            </div>
            {isComplete ? (
              <div className="text-emerald-400 text-[10px] mt-1">
                ✓ Tamamlandı
              </div>
            ) : (
              <div className="text-amber-400 text-[10px] mt-1">
                ⚠ {requiredCount - assignedCount} eksik
              </div>
            )}
          </div>
        </Html>
      )}

      {/* Selection indicator */}
      {isSelected && (
        <>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry
              args={[counterWidth + 0.05, counterWidth + 0.12, 32]}
            />
            <meshBasicMaterial color={color} transparent opacity={0.8} />
          </mesh>
          <mesh position={[0, baseHeight + 0.2, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.4, 8]} />
            <meshBasicMaterial color={color} transparent opacity={0.7} />
          </mesh>
          <mesh position={[0, baseHeight + 0.45, 0]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshBasicMaterial color={color} />
          </mesh>
        </>
      )}

      {/* Bar/Counter Base - Dikdörtgen tezgah */}
      <mesh position={[0, baseHeight / 2, 0]} castShadow>
        <boxGeometry args={[counterWidth, baseHeight, counterDepth]} />
        <meshStandardMaterial color="#1e293b" metalness={0.2} roughness={0.8} />
      </mesh>

      {/* Counter Top - Üst yüzey */}
      <mesh position={[0, baseHeight + 0.02, 0]} castShadow>
        <boxGeometry args={[counterWidth + 0.04, 0.04, counterDepth + 0.04]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.6} />
      </mesh>

      {/* Dekoratif ışık şeridi */}
      <mesh position={[0, baseHeight - 0.05, counterDepth / 2 + 0.01]}>
        <boxGeometry args={[counterWidth - 0.05, 0.02, 0.01]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* İsim etiketi - ÖN TARAFA ALINDI */}
      <Text
        position={[0, baseHeight + 0.2, -counterDepth / 2 - 0.08]}
        fontSize={0.16}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.005}
        outlineColor="#000000"
        rotation={[0, Math.PI, 0]}
      >
        {servicePoint.name}
      </Text>

      {/* Personel sayısı badge */}
      <Html position={[counterWidth / 2 + 0.1, baseHeight, 0]} center>
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
            isComplete
              ? "bg-emerald-500 border-emerald-400 text-white"
              : "bg-amber-500 border-amber-400 text-white"
          }`}
        >
          {assignedCount}
        </div>
      </Html>
    </group>
  );
}

// ==================== ENTRANCE MARKER ====================
function EntranceMarker({
  position,
  scale,
}: {
  position: { x: number; y: number };
  scale: number;
}) {
  const x = position.x * scale;
  const z = position.y * scale;
  const pulseRef = useRef<THREE.Mesh>(null);

  // Pulse animasyonu
  useFrame((state) => {
    if (pulseRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.1 + 1;
      pulseRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group position={[x, 0, z]}>
      {/* Base circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.25, 32]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.8} />
      </mesh>

      {/* Pulse ring */}
      <mesh
        ref={pulseRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.03, 0]}
      >
        <ringGeometry args={[0.25, 0.35, 32]} />
        <meshBasicMaterial color="#34d399" transparent opacity={0.5} />
      </mesh>

      {/* Person icon - cylinder body */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.3, 16]} />
        <meshStandardMaterial color="#10b981" />
      </mesh>

      {/* Person head */}
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color="#10b981" />
      </mesh>

      {/* Label */}
      <Html position={[0, 0.8, 0]} center>
        <div className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold whitespace-nowrap shadow-lg animate-pulse">
          📍 SİZ BURADASINIZ
        </div>
      </Html>
    </group>
  );
}

// ==================== PATH LINE ====================
function PathLine({
  start,
  end,
  scale,
  isActive,
}: {
  start: { x: number; y: number };
  end: { x: number; y: number };
  scale: number;
  isActive: boolean;
}) {
  const lineRef = useRef<any>(null);
  const arrowRef = useRef<THREE.Group>(null);
  const [dashOffset, setDashOffset] = useState(0);

  // Animasyonlu dash offset
  useFrame((state) => {
    if (isActive) {
      setDashOffset(state.clock.elapsedTime * 2);
    }
  });

  if (!isActive) return null;

  const startPos: [number, number, number] = [
    start.x * scale,
    0.1,
    start.y * scale,
  ];
  const endPos: [number, number, number] = [end.x * scale, 0.1, end.y * scale];

  // Yön vektörü
  const dx = endPos[0] - startPos[0];
  const dz = endPos[2] - startPos[2];
  const distance = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);

  // Ara noktalar (eğri için)
  const midX = (startPos[0] + endPos[0]) / 2;
  const midZ = (startPos[2] + endPos[2]) / 2;
  const midY = 0.3; // Ortada yüksel

  const points: [number, number, number][] = [
    startPos,
    [midX, midY, midZ],
    endPos,
  ];

  return (
    <group>
      {/* Ana yol çizgisi */}
      <Line
        points={points}
        color="#22d3ee"
        lineWidth={4}
        dashed
        dashScale={10}
        dashSize={0.3}
        dashOffset={dashOffset}
      />

      {/* Glow effect */}
      <Line
        points={points}
        color="#06b6d4"
        lineWidth={8}
        transparent
        opacity={0.3}
      />

      {/* Ok başı - hedef noktada */}
      <group position={endPos} rotation={[0, -angle, 0]}>
        <mesh position={[0, 0, -0.15]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.1, 0.2, 8]} />
          <meshBasicMaterial color="#22d3ee" />
        </mesh>
      </group>
    </group>
  );
}

// ==================== SCENE ====================
function Scene({
  layout,
  tables,
  servicePoints,
  tableGroups,
  teams,
  viewMode,
  selectedTableId,
  selectedServicePointId,
  onTableSelect,
  onServicePointSelect,
  controlsRef,
  onTableClick,
  entrancePosition,
  showPath,
}: {
  layout: VenueLayout;
  tables: CanvasTable[];
  servicePoints: ServicePoint[];
  tableGroups: TableGroup[];
  teams: TeamDefinition[];
  viewMode: ViewMode;
  selectedTableId: string | null;
  selectedServicePointId: string | null;
  onTableSelect: (id: string | null) => void;
  onServicePointSelect: (id: string | null) => void;
  controlsRef: React.RefObject<any>;
  onTableClick?: (tableId: string) => void;
  entrancePosition?: { x: number; y: number };
  showPath?: boolean;
}) {
  const width = layout.width * SCALE;
  const height = layout.height * SCALE;

  // Floor ve grid'i (0,0)'dan başlat - masalarla aynı koordinat sistemi
  const centerX = width / 2;
  const centerZ = height / 2;
  const camDist = Math.max(width, height) * 0.8;

  // Kamera: Üstten ortaya bakacak, hafif arkadan açılı
  const cameraY = camDist * 0.7;
  const cameraZ = centerZ + camDist * 0.3;

  // Sadece NORMAL masaların (loca olmayanların) sınırlarını hesapla - arka duvar pozisyonu için
  const venueBounds = useMemo(() => {
    const normalTables = tables.filter((t) => {
      const isLoca =
        t.label?.toUpperCase().startsWith("L") ||
        t.typeName?.toLowerCase().includes("loca") ||
        t.floor === 2;
      return !isLoca;
    });

    if (normalTables.length === 0) return null;

    let minX = Infinity,
      maxX = -Infinity;
    let minZ = Infinity,
      maxZ = -Infinity;
    normalTables.forEach((t) => {
      const x = t.x * SCALE;
      const z = t.y * SCALE;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    });
    return { minX, maxX, minZ, maxZ };
  }, [tables]);

  // LOCA masalarının pozisyonlarını ARKA DUVARA taşı (maxZ tarafı - sahnenin KARŞISI)
  const processedTables = useMemo(() => {
    if (!venueBounds) return tables;

    const WALL_DISTANCE = 2.5; // Balkon ile aynı mesafe - ARTIRILDI
    const BALCONY_DEPTH = 1.4;
    // maxZ tarafı - sahnenin karşısı, arka duvar
    const backWallZ = venueBounds.maxZ + WALL_DISTANCE;
    // Balkon merkezi
    const balconyZ = backWallZ - BALCONY_DEPTH / 2;

    // Loca masalarını bul
    const locaTables = tables.filter((t) => {
      const isLoca =
        t.label?.toUpperCase().startsWith("L") ||
        t.typeName?.toLowerCase().includes("loca");
      return t.floor === 2 || isLoca;
    });

    // Loca sayısına göre X pozisyonlarını hesapla - balkon genişliğine göre
    const locaCount = locaTables.length;
    const LOCA_WIDTH = 0.65;
    const LOCA_GAP = 0.25;
    const balconyWidth = Math.max(
      locaCount * (LOCA_WIDTH + LOCA_GAP) + 0.4,
      2.5
    );

    // Venue ortası
    const venueWidth = venueBounds.maxX - venueBounds.minX;
    const venueCenterX = venueBounds.minX + venueWidth / 2;

    // Balkon başlangıç X pozisyonu (ortadan başla)
    const balconyStartX = venueCenterX - balconyWidth / 2;
    const spacing = balconyWidth / (locaCount + 1);

    // Locaları sırala (label'a göre)
    const sortedLocas = [...locaTables].sort((a, b) => {
      const aNum = parseInt(a.label?.replace(/\D/g, "") || "0");
      const bNum = parseInt(b.label?.replace(/\D/g, "") || "0");
      return aNum - bNum;
    });

    // Loca ID -> yeni pozisyon map'i
    const locaPositions = new Map<string, { x: number; y: number }>();
    sortedLocas.forEach((loca, index) => {
      const newX = (balconyStartX + spacing * (index + 1)) / SCALE;
      const newZ = balconyZ / SCALE;
      locaPositions.set(loca.id, { x: newX, y: newZ });
    });

    // Tüm masaları işle - locaların pozisyonunu override et
    return tables.map((table) => {
      const newPos = locaPositions.get(table.id);
      if (newPos) {
        return { ...table, x: newPos.x, y: newPos.y };
      }
      return table;
    });
  }, [tables, venueBounds]);

  // Masa -> Grup map'i (table.label ile eşleştir, table.id değil!)
  const tableToGroupMap = useMemo(() => {
    const map = new Map<string, TableGroup>();

    // Her masa için label'a göre grup bul
    processedTables.forEach((table) => {
      const tableLabel = table.label; // "1", "2", "96", "L1" gibi

      // Bu label'ı içeren grubu bul
      const matchingGroup = tableGroups.find((group) =>
        group.tableIds.some((tid) => {
          // Direkt eşleşme
          if (tid === tableLabel) return true;
          // Sayısal eşleşme (örn: "1" === "1")
          if (tid === tableLabel.toString()) return true;
          // Loca için "L" prefix'i olmadan eşleşme
          if (tableLabel.startsWith("L") && tid === tableLabel.substring(1))
            return true;
          return false;
        })
      );

      if (matchingGroup) {
        map.set(table.id, matchingGroup);
      }
    });

    return map;
  }, [tableGroups, processedTables]);

  // Grup -> Takım map'i
  const groupToTeamMap = useMemo(() => {
    const map = new Map<string, TeamDefinition>();
    teams.forEach((team) => {
      team.assignedGroupIds.forEach((groupId) => map.set(groupId, team));
    });
    // Ayrıca grup.assignedTeamId'den de bak
    tableGroups.forEach((group) => {
      if (group.assignedTeamId) {
        const team = teams.find((t) => t.id === group.assignedTeamId);
        if (team) map.set(group.id, team);
      }
    });
    return map;
  }, [teams, tableGroups]);

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[centerX, cameraY, cameraZ]}
        fov={50}
      />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[centerX + 5, 10, centerZ - 5]}
        intensity={0.7}
        castShadow
      />
      <directionalLight
        position={[centerX - 5, 8, centerZ + 5]}
        intensity={0.3}
      />
      {/* Floor - click to deselect */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[centerX, 0, centerZ]}
        receiveShadow
        onClick={() => {
          onTableSelect(null);
          onServicePointSelect(null);
        }}
      >
        <planeGeometry args={[width * 1.2, height * 1.2]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[centerX, 0.001, centerZ]}
      >
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#1e1b4b" />
      </mesh>
      <gridHelper
        args={[Math.max(width, height) * 1.1, 25, "#334155", "#1e293b"]}
        position={[centerX, 0.002, centerZ]}
      />
      {/* Venue Walls - Şeffaf cam duvarlar ve logolar */}
      <Suspense fallback={null}>
        <VenueWalls
          width={width}
          height={height}
          centerX={centerX}
          centerZ={centerZ}
        />
      </Suspense>
      {layout.zones?.map((zone) => (
        <ZoneMesh key={zone.id} zone={zone} scale={SCALE} />
      ))}
      {/* Service Points */}
      {servicePoints.map((sp) => (
        <ServicePointMesh
          key={sp.id}
          servicePoint={sp}
          scale={SCALE}
          isSelected={selectedServicePointId === sp.id}
          onSelect={() => {
            onServicePointSelect(sp.id);
            onTableSelect(null);
          }}
        />
      ))}
      {processedTables.map((table) => {
        const group = tableToGroupMap.get(table.id);
        const team = group ? groupToTeamMap.get(group.id) : undefined;

        return (
          <TableMesh
            key={table.id}
            table={table}
            scale={SCALE}
            isSelected={selectedTableId === table.id}
            onSelect={() => {
              onTableSelect(table.id);
              onServicePointSelect(null);
              onTableClick?.(table.id);
            }}
            group={group}
            team={team}
            viewMode={viewMode}
          />
        );
      })}
      {/* Entrance Marker - Personel konumu */}
      {entrancePosition && (
        <EntranceMarker position={entrancePosition} scale={SCALE} />
      )}{" "}
      {/* 2. Kat Platformu - Localar için */}
      <SecondFloorPlatform
        tables={processedTables}
        scale={SCALE}
        centerX={centerX}
        centerZ={centerZ}
      />
      {/* Path Line - Hedef masaya yol */}
      {entrancePosition &&
        selectedTableId &&
        showPath &&
        (() => {
          const targetTable = processedTables.find(
            (t) => t.id === selectedTableId
          );
          if (!targetTable) return null;
          return (
            <PathLine
              start={entrancePosition}
              end={{ x: targetTable.x, y: targetTable.y }}
              scale={SCALE}
              isActive={true}
            />
          );
        })()}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={2}
        maxDistance={18}
        maxPolarAngle={Math.PI / 2.1}
        target={[centerX, 0, centerZ]}
      />
    </>
  );
}

// ==================== INTRO OVERLAY ====================
function IntroOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-30 bg-slate-900/95 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-sm w-full shadow-2xl">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center">
              <span className="text-xl">🎮</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">3D Önizleme</h3>
              <p className="text-xs text-slate-400">
                Mekanınızı 3 boyutlu görün
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3 p-2 rounded-lg bg-slate-700/30">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
              <Move className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <p className="text-white font-medium">Döndür</p>
              <p className="text-slate-400 text-xs">
                Sol tık basılı tutup sürükle
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-2 rounded-lg bg-slate-700/30">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <ZoomIn className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <p className="text-white font-medium">Yakınlaştır / Uzaklaştır</p>
              <p className="text-slate-400 text-xs">Mouse tekerleğini kullan</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-2 rounded-lg bg-slate-700/30">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <MousePointer className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-white font-medium">Masa Bilgisi</p>
              <p className="text-slate-400 text-xs">
                Masaya tıklayarak detayları gör
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-slate-700/50 border border-slate-600">
          <p className="text-xs text-slate-400 flex items-center gap-2">
            <span className="text-amber-400">💡</span>
            3D modda sadece görüntüleme yapılabilir. Düzenleme için 2D moduna
            dönün.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white rounded-lg font-medium transition-all shadow-lg shadow-cyan-500/20"
        >
          Anladım, Başla
        </button>
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================
interface Canvas3DPreviewProps {
  layout: VenueLayout;
  tables: CanvasTable[];
  servicePoints?: ServicePoint[];
  tableGroups?: TableGroup[];
  teams?: TeamDefinition[];
  viewMode?: ViewMode;
  selectedTableIds?: string[];
  onClose?: () => void;
  onTableClick?: (tableId: string) => void;
  entrancePosition?: { x: number; y: number };
  showPath?: boolean;
}

export function Canvas3DPreview({
  layout,
  tables,
  servicePoints = [],
  tableGroups = [],
  teams = [],
  viewMode = "default",
  selectedTableIds = [],
  onClose,
  onTableClick,
  entrancePosition,
  showPath = true,
}: Canvas3DPreviewProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedServicePointId, setSelectedServicePointId] = useState<
    string | null
  >(null);
  const controlsRef = useRef<any>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const limitedTables = useMemo(() => tables.slice(0, 200), [tables]);

  // Layout boyutları
  const width = layout.width * SCALE;
  const height = layout.height * SCALE;
  const centerX = width / 2;
  const centerZ = height / 2;
  const camDist = Math.max(width, height) * 0.8;

  // İlk seçili masayı göster
  useEffect(() => {
    if (selectedTableIds.length > 0) {
      setSelectedTableId(selectedTableIds[0]);
    }
  }, [selectedTableIds]);

  // Masa seçildiğinde kamerayı o masaya odakla
  useEffect(() => {
    if (selectedTableId && controlsRef.current) {
      const table = limitedTables.find((t) => t.id === selectedTableId);
      if (table) {
        const tableX = table.x * SCALE;
        const tableZ = table.y * SCALE;

        // Kamerayı masanın önüne (sahne tarafından bakacak şekilde) konumlandır
        // Masanın biraz arkasından ve yukarıdan bak
        const camera = controlsRef.current.object;
        const target = controlsRef.current.target;

        // Hedef: Masanın kendisi
        target.set(tableX, 0.3, tableZ);

        // Kamera: Masanın arkasından (sahneye doğru bakacak şekilde)
        // Z ekseni boyunca masanın arkasına, biraz yukarıdan
        camera.position.set(tableX, 2.5, tableZ + 3);

        controlsRef.current.update();
      }
    }
  }, [selectedTableId, limitedTables]);

  // localStorage'dan intro durumunu kontrol et
  useEffect(() => {
    const seen = localStorage.getItem("3d-preview-intro-seen");
    if (seen === "true") {
      setShowIntro(false);
    }
  }, []);

  const handleCloseIntro = useCallback(() => {
    setShowIntro(false);
    localStorage.setItem("3d-preview-intro-seen", "true");
  }, []);

  // Kamerayı merkeze sıfırla
  const resetCamera = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.target.set(centerX, 0, centerZ);
      controlsRef.current.object.position.set(
        centerX,
        camDist * 0.7,
        centerZ + camDist * 0.4
      );
      controlsRef.current.update();
    }
  }, [centerX, centerZ, camDist]);

  // 3D Zoom In
  const zoomIn = useCallback(() => {
    if (controlsRef.current) {
      const camera = controlsRef.current.object;
      const target = controlsRef.current.target;
      const direction = new THREE.Vector3()
        .subVectors(target, camera.position)
        .normalize();
      camera.position.addScaledVector(direction, 1);
      controlsRef.current.update();
    }
  }, []);

  // 3D Zoom Out
  const zoomOut = useCallback(() => {
    if (controlsRef.current) {
      const camera = controlsRef.current.object;
      const target = controlsRef.current.target;
      const direction = new THREE.Vector3()
        .subVectors(target, camera.position)
        .normalize();
      camera.position.addScaledVector(direction, -1);
      controlsRef.current.update();
    }
  }, []);

  // Ekran görüntüsü al
  const takeScreenshot = useCallback(() => {
    const canvas = canvasContainerRef.current?.querySelector("canvas");
    if (canvas) {
      const link = document.createElement("a");
      link.download = `3d-yerlesim-${new Date()
        .toISOString()
        .slice(0, 10)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    }
  }, []);

  if (hasError) {
    return (
      <div className="w-full h-full min-h-[500px] bg-slate-900 flex items-center justify-center">
        <p className="text-red-400">3D görüntüleme başarısız</p>
      </div>
    );
  }

  return (
    <div
      ref={canvasContainerRef}
      className="w-full h-full min-h-[500px] bg-slate-900 rounded-lg overflow-hidden relative"
    >
      {/* Loading */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-900/90">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      )}

      {/* Intro overlay */}
      {showIntro && !isLoading && <IntroOverlay onClose={handleCloseIntro} />}

      {/* Sol üst: Mode indicator + Help text with mouse icons */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-2">
        <div className="bg-cyan-600/90 text-white text-xs px-3 py-1.5 rounded-lg font-medium">
          👁️ 3D Önizleme
        </div>
        <div className="text-xs bg-slate-800/90 px-3 py-2 rounded-lg border border-slate-700 space-y-1.5">
          <div className="flex items-center gap-2 text-slate-300">
            <MousePointerClick className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sol tık: Masa bilgisi</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Move className="w-3.5 h-3.5 text-purple-400" />
            <span>Sağ tık: Sağa/sola hareket</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <ZoomIn className="w-3.5 h-3.5 text-amber-400" />
            <span>Scroll: Yakınlaştır/Uzaklaştır</span>
          </div>
        </div>
      </div>

      {/* Sağ üst: Zoom + Screenshot + Home + Kapat butonları */}
      <div className="absolute top-3 right-3 z-20 flex gap-2">
        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-slate-800/90 rounded-lg p-1 border border-slate-700">
          <button
            onClick={zoomOut}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title="Uzaklaştır"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={zoomIn}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title="Yakınlaştır"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={resetCamera}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded border-l border-slate-600 transition-colors"
            title="Sıfırla"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={takeScreenshot}
          className="p-2 rounded-lg bg-emerald-600/80 text-white hover:bg-emerald-500 transition-colors"
          title="Ekran Görüntüsü Al"
        >
          <Camera className="w-4 h-4" />
        </button>
        <button
          onClick={resetCamera}
          className="p-2 rounded-lg bg-slate-700/80 text-slate-300 hover:bg-slate-600 transition-colors"
          title="Görünümü Ortala"
        >
          <Home className="w-4 h-4" />
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-red-600/80 text-white hover:bg-red-500 transition-colors"
            title="3D Modunu Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Seçili Masa Numarası - Üstte ortada göster */}
      {selectedTableId && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-cyan-600 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in zoom-in duration-300">
            <MapPin className="w-6 h-6" />
            <span className="text-2xl font-bold">
              MASA{" "}
              {limitedTables.find((t) => t.id === selectedTableId)?.label || ""}
            </span>
          </div>
        </div>
      )}

      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          preserveDrawingBuffer: true,
        }}
        onCreated={({ gl }) => {
          setIsLoading(false);
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            setHasError(true);
          });
        }}
      >
        <color attach="background" args={["#0f172a"]} />
        <fog attach="fog" args={["#0f172a", 12, 25]} />
        <Suspense fallback={null}>
          <Scene
            layout={layout}
            tables={limitedTables}
            servicePoints={servicePoints}
            tableGroups={tableGroups}
            teams={teams}
            viewMode={viewMode}
            selectedTableId={selectedTableId}
            selectedServicePointId={selectedServicePointId}
            onTableSelect={setSelectedTableId}
            onServicePointSelect={setSelectedServicePointId}
            controlsRef={controlsRef}
            onTableClick={onTableClick}
            entrancePosition={entrancePosition}
            showPath={showPath}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
