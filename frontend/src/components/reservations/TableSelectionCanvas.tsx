"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Stage, Layer, Rect, Circle, Text, Group, Line } from "react-konva";
import type { Event, TableInstance } from "@/types";
import Konva from "konva";
import { Canvas3DPreview } from "@/components/canvas/Canvas3DPreview";

// Misafir bilgileri tipi
interface GuestInfo {
  fullName: string;
  phone: string;
  email: string;
  guestCount: number;
}

interface TableSelectionCanvasProps {
  event: Event;
  reservedTableIds: string[];
  selectedTableId: string | null;
  onSelectTable: (tableId: string, capacity: number) => void;
  guestInfo?: GuestInfo;
  viewMode?: "2d" | "3d";
}

// Masa tipi ve kapasiteye göre çerçeve renkleri
const getTableBorderColor = (
  table: TableInstance,
  isReserved: boolean,
  isSelected: boolean
) => {
  if (isReserved) return "#DC2626"; // Kırmızı - rezerveli
  if (isSelected) return "#8B5CF6"; // Mor - seçili

  const typeName =
    table.typeName?.toLowerCase() || (table as any).type?.toLowerCase() || "";
  const capacity = table.capacity || 2;

  // Masa tipine göre renk
  if (typeName.includes("loca") || typeName.includes("vip")) {
    return "#F59E0B"; // Altın/Amber - VIP/Loca
  }
  if (typeName.includes("bar") || typeName.includes("high")) {
    return "#EC4899"; // Pembe - Bar masası
  }
  if (typeName.includes("kare") || typeName.includes("square")) {
    return "#06B6D4"; // Cyan - Kare masa
  }

  // Kapasiteye göre renk (yuvarlak masalar için)
  if (capacity <= 2) return "#22C55E"; // Yeşil - 2 kişilik
  if (capacity <= 4) return "#3B82F6"; // Mavi - 4 kişilik
  if (capacity <= 6) return "#8B5CF6"; // Mor - 6 kişilik
  if (capacity <= 8) return "#F59E0B"; // Amber - 8 kişilik
  return "#EF4444"; // Kırmızı - 8+ kişilik
};

// Masa tipi için şekil belirleme
const getTableShape = (table: TableInstance) => {
  const typeName =
    table.typeName?.toLowerCase() || (table as any).type?.toLowerCase() || "";
  if (typeName.includes("loca") || typeName.includes("vip")) return "loca";
  if (typeName.includes("kare") || typeName.includes("square")) return "square";
  if (typeName.includes("bar") || typeName.includes("high")) return "bar";
  return "circle";
};

export function TableSelectionCanvas({
  event,
  reservedTableIds,
  selectedTableId,
  onSelectTable,
  guestInfo,
  viewMode = "2d",
}: TableSelectionCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({
    width: 800,
    height: 600,
  });
  const [zoom, setZoom] = useState(1);
  const stageRef = useRef<Konva.Stage>(null);

  const layout = event.venueLayout;
  const tables = (layout as any)?.tables || (layout as any)?.placedTables || [];
  const stageElements = (layout as any)?.stageElements || [];

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // İçeriğin bounding box'ını hesapla
  const contentBounds = (() => {
    if (
      !tables.length &&
      !layout?.zones?.length &&
      !layout?.stage &&
      !stageElements.length
    ) {
      return {
        minX: 0,
        minY: 0,
        maxX: layout?.width || 800,
        maxY: layout?.height || 600,
      };
    }

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    const tableSize = 30;

    tables.forEach((table: any) => {
      minX = Math.min(minX, table.x - tableSize);
      minY = Math.min(minY, table.y - tableSize);
      maxX = Math.max(maxX, table.x + tableSize);
      maxY = Math.max(maxY, table.y + tableSize);
    });

    layout?.zones?.forEach((zone: any) => {
      minX = Math.min(minX, zone.x);
      minY = Math.min(minY, zone.y);
      maxX = Math.max(maxX, zone.x + zone.width);
      maxY = Math.max(maxY, zone.y + zone.height);
    });

    if (layout?.stage) {
      minX = Math.min(minX, layout.stage.x);
      minY = Math.min(minY, layout.stage.y);
      maxX = Math.max(maxX, layout.stage.x + layout.stage.width);
      maxY = Math.max(maxY, layout.stage.y + layout.stage.height);
    }

    stageElements.forEach((el: any) => {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + (el.width || 100));
      maxY = Math.max(maxY, el.y + (el.height || 50));
    });

    layout?.walls?.forEach((wall: any) => {
      for (let i = 0; i < wall.points.length; i += 2) {
        minX = Math.min(minX, wall.points[i]);
        maxX = Math.max(maxX, wall.points[i]);
        if (i + 1 < wall.points.length) {
          minY = Math.min(minY, wall.points[i + 1]);
          maxY = Math.max(maxY, wall.points[i + 1]);
        }
      }
    });

    return { minX: Math.max(0, minX), minY: Math.max(0, minY), maxX, maxY };
  })();

  const contentWidth = contentBounds.maxX - contentBounds.minX;
  const contentHeight = contentBounds.maxY - contentBounds.minY;
  const padding = 30;

  const fitZoom = Math.min(
    (containerSize.width - padding * 2) / contentWidth,
    (containerSize.height - padding * 2) / contentHeight,
    1.2
  );

  const scaledWidth = contentWidth * zoom * fitZoom;
  const scaledHeight = contentHeight * zoom * fitZoom;
  const offsetX =
    (containerSize.width - scaledWidth) / 2 -
    contentBounds.minX * zoom * fitZoom;
  const offsetY =
    (containerSize.height - scaledHeight) / 2 -
    contentBounds.minY * zoom * fitZoom;

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    setZoom((prev) => {
      const newZoom = e.evt.deltaY > 0 ? prev / scaleBy : prev * scaleBy;
      return Math.max(0.5, Math.min(3, newZoom));
    });
  }, []);

  const handleTableClick = (table: TableInstance) => {
    const isReserved = reservedTableIds.includes(table.id);
    if (!isReserved) {
      onSelectTable(table.id, table.capacity);
    }
  };

  // Masa render
  const renderTable = (table: TableInstance) => {
    const isReserved = reservedTableIds.includes(table.id);
    const isSelected = selectedTableId === table.id;
    const shape = getTableShape(table);
    const borderColor = getTableBorderColor(table, isReserved, isSelected);

    const baseSize = 40;
    const size = shape === "loca" ? 50 : baseSize;

    const fillColor = isReserved
      ? "#DC2626"
      : isSelected
      ? "#8B5CF620"
      : `${borderColor}15`;

    return (
      <Group
        key={table.id}
        x={table.x}
        y={table.y}
        rotation={table.rotation || 0}
        onClick={() => handleTableClick(table)}
        onTap={() => handleTableClick(table)}
      >
        {/* Seçili masa glow efekti */}
        {isSelected && (
          <>
            {shape === "circle" && (
              <Circle
                radius={size / 2 + 6}
                fill="transparent"
                stroke="#8B5CF6"
                strokeWidth={3}
                opacity={0.6}
                dash={[5, 3]}
              />
            )}
            {shape === "loca" && (
              <Rect
                width={size + 12}
                height={size * 0.7 + 12}
                offsetX={(size + 12) / 2}
                offsetY={(size * 0.7 + 12) / 2}
                fill="transparent"
                stroke="#8B5CF6"
                strokeWidth={3}
                cornerRadius={8}
                opacity={0.6}
                dash={[5, 3]}
              />
            )}
            {shape === "square" && (
              <Rect
                width={size + 10}
                height={size + 10}
                offsetX={(size + 10) / 2}
                offsetY={(size + 10) / 2}
                fill="transparent"
                stroke="#8B5CF6"
                strokeWidth={3}
                cornerRadius={4}
                opacity={0.6}
                dash={[5, 3]}
              />
            )}
            {shape === "bar" && (
              <Rect
                width={size * 0.6 + 10}
                height={size + 10}
                offsetX={(size * 0.6 + 10) / 2}
                offsetY={(size + 10) / 2}
                fill="transparent"
                stroke="#8B5CF6"
                strokeWidth={3}
                cornerRadius={4}
                opacity={0.6}
                dash={[5, 3]}
              />
            )}
          </>
        )}

        {/* Masa şekli */}
        {shape === "circle" && (
          <Circle
            radius={size / 2}
            fill={fillColor}
            stroke={borderColor}
            strokeWidth={isSelected ? 3 : 2}
          />
        )}
        {shape === "loca" && (
          <Rect
            width={size}
            height={size * 0.7}
            offsetX={size / 2}
            offsetY={(size * 0.7) / 2}
            fill={fillColor}
            stroke={borderColor}
            strokeWidth={isSelected ? 3 : 2}
            cornerRadius={6}
          />
        )}
        {shape === "square" && (
          <Rect
            width={size * 0.9}
            height={size * 0.9}
            offsetX={(size * 0.9) / 2}
            offsetY={(size * 0.9) / 2}
            fill={fillColor}
            stroke={borderColor}
            strokeWidth={isSelected ? 3 : 2}
            cornerRadius={4}
          />
        )}
        {shape === "bar" && (
          <Rect
            width={size * 0.5}
            height={size}
            offsetX={(size * 0.5) / 2}
            offsetY={size / 2}
            fill={fillColor}
            stroke={borderColor}
            strokeWidth={isSelected ? 3 : 2}
            cornerRadius={4}
          />
        )}

        {/* Masa etiketi */}
        <Text
          text={isReserved ? "R" : table.label}
          fontSize={isReserved ? 16 : 11}
          fontStyle="bold"
          fill={isReserved ? "#fff" : isSelected ? "#fff" : "#e2e8f0"}
          align="center"
          verticalAlign="middle"
          offsetX={isReserved ? 5 : (table.label?.length || 1) * 3}
          offsetY={shape === "loca" ? 4 : 5}
        />

        {/* Kapasite */}
        {!isReserved && (
          <Text
            text={`${table.capacity}k`}
            fontSize={8}
            fill={isSelected ? "#C4B5FD" : "#94a3b8"}
            align="center"
            offsetX={7}
            offsetY={shape === "loca" ? -6 : shape === "bar" ? -15 : -10}
          />
        )}
      </Group>
    );
  };

  // Zone render
  const renderZones = () => {
    if (!layout?.zones) return null;
    return layout.zones.map((zone: any) => (
      <Group key={zone.id}>
        <Rect
          x={zone.x}
          y={zone.y}
          width={zone.width}
          height={zone.height}
          fill={zone.color + "40"}
          stroke={zone.color}
          strokeWidth={2}
          cornerRadius={4}
        />
        <Text
          x={zone.x}
          y={zone.y + zone.height / 2 - 8}
          width={zone.width}
          text={zone.label}
          fontSize={14}
          fontStyle="bold"
          fill={zone.color}
          align="center"
        />
      </Group>
    ));
  };

  // Duvar render
  const renderWalls = () => {
    if (!layout?.walls) return null;
    return layout.walls.map((wall: any) => (
      <Line
        key={wall.id}
        points={wall.points}
        stroke={wall.color || "#64748b"}
        strokeWidth={wall.strokeWidth || 4}
        lineCap="round"
        lineJoin="round"
      />
    ));
  };

  // Stage Elements render (Sahne, System Control, DJ Booth vb.)
  const renderStageElements = () => {
    return stageElements.map((element: any) => {
      const { id, type, x, y, width, height, label, rotation } = element;

      let bgColor = "#1e293b";
      let borderColor = "#3b82f6";
      let icon = "🎤";

      switch (type?.toLowerCase()) {
        case "stage":
        case "sahne":
          bgColor = "#1e293b";
          borderColor = "#3b82f6";
          icon = "🎤";
          break;
        case "system_control":
        case "systemcontrol":
        case "control":
          bgColor = "#1f2937";
          borderColor = "#10B981";
          icon = "🎛️";
          break;
        case "dj":
        case "dj_booth":
          bgColor = "#1f2937";
          borderColor = "#8B5CF6";
          icon = "🎧";
          break;
        case "bar":
          bgColor = "#1f2937";
          borderColor = "#F59E0B";
          icon = "🍸";
          break;
        case "entrance":
        case "giris":
          bgColor = "#1f2937";
          borderColor = "#22C55E";
          icon = "🚪";
          break;
        case "exit":
        case "cikis":
          bgColor = "#1f2937";
          borderColor = "#EF4444";
          icon = "🚪";
          break;
        default:
          bgColor = "#1f2937";
          borderColor = "#64748b";
          icon = "📍";
      }

      return (
        <Group key={id} x={x} y={y} rotation={rotation || 0}>
          <Rect
            width={width || 120}
            height={height || 60}
            fill={bgColor}
            stroke={borderColor}
            strokeWidth={2}
            cornerRadius={8}
            shadowColor="#000"
            shadowBlur={5}
            shadowOpacity={0.3}
          />
          <Text x={10} y={(height || 60) / 2 - 10} text={icon} fontSize={18} />
          <Text
            x={35}
            y={(height || 60) / 2 - 8}
            width={(width || 120) - 45}
            text={label || type?.toUpperCase() || "ELEMENT"}
            fontSize={12}
            fontStyle="bold"
            fill="#fff"
            align="left"
          />
        </Group>
      );
    });
  };

  return (
    <div className="w-full">
      {/* Misafir Bilgileri Özeti */}
      {guestInfo && (
        <div className="mb-3 p-3 bg-slate-700/50 rounded-lg border border-slate-600">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Misafir:</span>
                <span className="font-medium text-white">
                  {guestInfo.fullName}
                </span>
              </div>
              {guestInfo.phone && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Tel:</span>
                  <span className="text-slate-300">{guestInfo.phone}</span>
                </div>
              )}
              {guestInfo.email && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">E-posta:</span>
                  <span className="text-slate-300">{guestInfo.email}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 bg-purple-600/20 px-3 py-1 rounded-full">
              <span className="text-purple-400 font-medium">
                {guestInfo.guestCount} Kişi
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Lejant - Masa Tipleri ve Kapasiteler */}
      <div className="mb-3 p-2 bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-slate-400 font-medium">Kapasite:</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border-2 border-green-500" />
            <span className="text-slate-300">2k</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border-2 border-blue-500" />
            <span className="text-slate-300">4k</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border-2 border-purple-500" />
            <span className="text-slate-300">6k</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border-2 border-amber-500" />
            <span className="text-slate-300">8k+</span>
          </div>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400 font-medium">Tip:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 rounded border-2 border-amber-500" />
            <span className="text-slate-300">VIP/Loca</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded border-2 border-cyan-500" />
            <span className="text-slate-300">Kare</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-4 rounded border-2 border-pink-500" />
            <span className="text-slate-300">Bar</span>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="w-full h-[500px] bg-slate-900 rounded-lg overflow-hidden"
      >
        {viewMode === "3d" ? (
          <Canvas3DPreview
            layout={{
              width: layout?.width || 800,
              height: layout?.height || 600,
              tables: [],
              walls: layout?.walls || [],
              gridSize: 20,
              zones: [
                ...(layout?.zones || []).map((zone: any) => ({
                  id: zone.id,
                  type: "zone" as const,
                  x: zone.x,
                  y: zone.y,
                  width: zone.width,
                  height: zone.height,
                  label: zone.label,
                  color: zone.color,
                })),
                ...stageElements.map((el: any) => ({
                  id: el.id,
                  type:
                    el.type === "stage"
                      ? "stage"
                      : el.type === "system_control"
                      ? "system"
                      : "stage-extension",
                  x: el.x,
                  y: el.y,
                  width: el.width || 120,
                  height: el.height || 60,
                  label: el.label,
                  color:
                    el.type === "stage"
                      ? "#1e40af"
                      : el.type === "system_control"
                      ? "#d97706"
                      : "#7c3aed",
                })),
              ],
            }}
            tables={tables.map((t: any) => {
              const isReserved = reservedTableIds.includes(t.id);
              const isSelected = selectedTableId === t.id;
              const typeName =
                t.typeName?.toLowerCase() || t.type?.toLowerCase() || "";
              const isLoca =
                typeName.includes("loca") || typeName.includes("vip");

              // Renk: Rezerveli kırmızı, seçili mor, normal yeşil
              let color = "#22C55E"; // Yeşil - müsait
              if (isReserved) color = "#DC2626"; // Kırmızı - rezerveli
              else if (isSelected) color = "#8B5CF6"; // Mor - seçili

              // Label oluştur
              let displayLabel = t.label;
              if (!displayLabel && t.tableNumber) {
                displayLabel = `Masa ${t.tableNumber}`;
              }
              if (!displayLabel) {
                const idParts = t.id.split("-");
                displayLabel = `Masa ${idParts[idParts.length - 1]}`;
              }

              return {
                id: t.id,
                typeId: t.type || "standard",
                typeName: isLoca ? "Loca" : t.typeName || "Masa",
                x: t.x,
                y: t.y,
                rotation: t.rotation || 0,
                capacity: t.capacity || 12,
                color: color,
                shape: isLoca ? "square" : "round",
                label: displayLabel,
                floor: isLoca ? 2 : 1,
              };
            })}
            servicePoints={[]}
            tableGroups={[]}
            teams={[]}
            viewMode="step1"
            selectedTableIds={selectedTableId ? [selectedTableId] : []}
            onTableClick={(tableId) => {
              const table = tables.find((t: any) => t.id === tableId);
              if (table && !reservedTableIds.includes(tableId)) {
                onSelectTable(tableId, table.capacity);
              }
            }}
          />
        ) : (
          <div className="w-full h-full cursor-grab active:cursor-grabbing">
            <Stage
              ref={stageRef}
              x={offsetX}
              y={offsetY}
              width={containerSize.width}
              height={containerSize.height}
              scaleX={zoom * fitZoom}
              scaleY={zoom * fitZoom}
              draggable
              onWheel={handleWheel}
            >
              <Layer>
                {/* Arkaplan */}
                <Rect
                  x={0}
                  y={0}
                  width={layout?.width || 800}
                  height={layout?.height || 600}
                  fill="#0f172a"
                />

                {/* Zones */}
                {renderZones()}

                {/* Duvarlar */}
                {renderWalls()}

                {/* Eski format sahne (layout.stage) */}
                {layout?.stage && (
                  <Group x={layout.stage.x} y={layout.stage.y}>
                    <Rect
                      width={layout.stage.width}
                      height={layout.stage.height}
                      fill="#1e293b"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      cornerRadius={8}
                      shadowColor="#3b82f6"
                      shadowBlur={10}
                      shadowOpacity={0.3}
                    />
                    <Text
                      x={10}
                      y={layout.stage.height / 2 - 10}
                      text="🎤"
                      fontSize={18}
                    />
                    <Text
                      x={35}
                      y={layout.stage.height / 2 - 8}
                      width={layout.stage.width - 45}
                      text={layout.stage.label || "SAHNE"}
                      fontSize={14}
                      fontStyle="bold"
                      fill="#fff"
                      align="left"
                    />
                  </Group>
                )}

                {/* Stage Elements (yeni format - sahne, system control vb.) */}
                {renderStageElements()}

                {/* Masalar */}
                {tables.map(renderTable)}
              </Layer>
            </Stage>
          </div>
        )}
      </div>
    </div>
  );
}
