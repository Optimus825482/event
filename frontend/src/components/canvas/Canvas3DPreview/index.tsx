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
  // Masa pozisyonunu direkt kullan
  const x = table.x * scale;
  const z = table.y * scale;

  // Renk: Grup varsa grup rengi, yoksa masa rengi
  const color = group?.color || table.color || "#3b82f6";

  // Personel sayısı
  const staffCount = group?.staffAssignments?.length || 0;

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
        <Html position={[0, 0.8, 0]} center distanceFactor={10}>
          <div className="bg-slate-800/95 text-white text-xs px-3 py-2 rounded-lg shadow-xl whitespace-nowrap border border-cyan-500/50 pointer-events-none animate-in fade-in zoom-in duration-200 min-w-[140px]">
            {/* Step 1: Grup bilgileri */}
            {viewMode === "step1" && group && (
              <>
                <div
                  className="font-semibold text-sm"
                  style={{ color: group.color }}
                >
                  {group.name}
                </div>
                <div className="text-slate-300 mt-1 flex items-center gap-1">
                  <span className="text-slate-400">Masa:</span> {table.label}
                </div>
                <div className="text-slate-300 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span>{staffCount} Personel</span>
                </div>
                {staffCount > 0 && (
                  <div className="mt-1 pt-1 border-t border-slate-600 space-y-0.5">
                    {group.staffAssignments?.slice(0, 3).map((s, i) => (
                      <div
                        key={i}
                        className="text-[10px] text-slate-400 truncate max-w-[120px]"
                      >
                        • {s.staffName || "Personel"}
                      </div>
                    ))}
                    {staffCount > 3 && (
                      <div className="text-[10px] text-slate-500">
                        +{staffCount - 3} daha...
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Step 2: Takım bilgileri */}
            {viewMode === "step2" && team && (
              <>
                <div
                  className="font-semibold text-sm"
                  style={{ color: team.color }}
                >
                  {team.name}
                </div>
                {group && (
                  <div className="text-slate-300 mt-1 flex items-center gap-1">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: group.color }}
                    />
                    <span>{group.name}</span>
                  </div>
                )}
                <div className="text-slate-300 flex items-center gap-1">
                  <span className="text-slate-400">Masa:</span> {table.label}
                </div>
                <div className="text-slate-300 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span>{staffCount} Personel</span>
                </div>
              </>
            )}

            {/* Step 2 - Takımsız grup */}
            {viewMode === "step2" && !team && group && (
              <>
                <div className="font-semibold text-sm text-amber-400">
                  ⚠ Takıma Atanmamış
                </div>
                <div className="text-slate-300 mt-1 flex items-center gap-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: group.color }}
                  />
                  <span>{group.name}</span>
                </div>
                <div className="text-slate-300 flex items-center gap-1">
                  <span className="text-slate-400">Masa:</span> {table.label}
                </div>
              </>
            )}

            {/* Default veya grupsuz masa */}
            {(viewMode === "default" || !group) && (
              <>
                <div className="font-semibold text-cyan-300 text-sm">
                  {table.label}
                </div>
                <div className="text-slate-300 mt-0.5">{table.typeName}</div>
                <div className="text-slate-400">{table.capacity} Kişilik</div>
              </>
            )}
          </div>
        </Html>
      )}

      {/* Selection indicator */}
      {isSelected && (
        <>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry
              args={[TABLE_RADIUS + 0.06, TABLE_RADIUS + 0.12, 32]}
            />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.8} />
          </mesh>
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.8, 8]} />
            <meshBasicMaterial color="#06b6d4" transparent opacity={0.7} />
          </mesh>
          <mesh position={[0, 1.05, 0]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshBasicMaterial color="#22d3ee" />
          </mesh>
        </>
      )}

      {/* Table cloth */}
      <mesh position={[0, 0.38, 0]} castShadow>
        <cylinderGeometry
          args={[TABLE_RADIUS, TABLE_RADIUS + 0.01, 0.02, 20]}
        />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* Table top */}
      <mesh position={[0, 0.36, 0]} castShadow>
        <cylinderGeometry
          args={[TABLE_RADIUS - 0.01, TABLE_RADIUS - 0.01, 0.02, 20]}
        />
        <meshStandardMaterial color="#f1f5f9" />
      </mesh>

      {/* Table leg */}
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.02, 0.03, 0.34, 8]} />
        <meshStandardMaterial color="#475569" metalness={0.3} roughness={0.7} />
      </mesh>

      {/* Base */}
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.02, 12]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
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
  const color = servicePoint.color || "#06b6d4";
  const assignedCount =
    servicePoint.staffAssignments?.length ||
    servicePoint.assignedStaffCount ||
    0;
  const requiredCount = servicePoint.requiredStaffCount;
  const isComplete = assignedCount >= requiredCount;

  // Hizmet noktası tipi için yükseklik
  const baseHeight = 0.6;
  const counterWidth = 0.4;
  const counterDepth = 0.2;

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

      {/* İsim etiketi */}
      <Text
        position={[0, baseHeight + 0.15, counterDepth / 2 + 0.05]}
        fontSize={0.06}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.003}
        outlineColor="#000000"
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

      {/* Mesafe etiketi */}
      <Html position={[midX, midY + 0.2, midZ]} center>
        <div className="bg-cyan-600/90 text-white text-xs px-2 py-1 rounded font-mono whitespace-nowrap">
          {Math.round(distance / scale)}px
        </div>
      </Html>
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

  // Masa -> Grup map'i
  const tableToGroupMap = useMemo(() => {
    const map = new Map<string, TableGroup>();
    tableGroups.forEach((group) => {
      group.tableIds.forEach((tableId) => map.set(tableId, group));
    });
    return map;
  }, [tableGroups]);

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

      {tables.map((table) => {
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
      )}

      {/* Path Line - Hedef masaya yol */}
      {entrancePosition &&
        selectedTableId &&
        showPath &&
        (() => {
          const targetTable = tables.find((t) => t.id === selectedTableId);
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
