"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Stage, Layer, Rect, Circle, Text, Group, Line } from "react-konva";
import type { Event, Reservation } from "@/types";
import Konva from "konva";
import { Canvas3DPreview } from "@/components/canvas/Canvas3DPreview";
import { X } from "lucide-react";

interface ReservationViewCanvasProps {
  event: Event;
  reservations: Reservation[];
  onTableClick?: (tableId: string) => void;
  viewMode?: "2d" | "3d";
}

// Durum etiketleri
const statusLabels: Record<string, { label: string; color: string }> = {
  confirmed: { label: "Onaylı", color: "text-green-400" },
  pending: { label: "Beklemede", color: "text-yellow-400" },
  checked_in: { label: "Giriş Yapıldı", color: "text-blue-400" },
  available: { label: "Boş", color: "text-emerald-400" },
};

// Masa durumuna göre renk
const getTableColors = (tableId: string, reservations: Reservation[]) => {
  const reservation = reservations.find(
    (r) =>
      r.tableId === tableId &&
      r.status !== "cancelled" &&
      r.status !== "no_show"
  );

  if (!reservation) {
    return { fill: "#22C55E20", stroke: "#22C55E", status: "available" }; // Yeşil - Boş
  }

  switch (reservation.status) {
    case "confirmed":
      return { fill: "#DC2626", stroke: "#EF4444", status: "confirmed" }; // Kırmızı - Dolu
    case "pending":
      return { fill: "#F59E0B", stroke: "#FBBF24", status: "pending" }; // Sarı - Beklemede
    case "checked_in":
      return { fill: "#3B82F6", stroke: "#60A5FA", status: "checked_in" }; // Mavi - Giriş yapıldı
    default:
      return { fill: "#22C55E20", stroke: "#22C55E", status: "available" };
  }
};

export function ReservationViewCanvas({
  event,
  reservations,
  onTableClick,
  viewMode = "2d",
}: ReservationViewCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({
    width: 800,
    height: 600,
  });
  const [zoom, setZoom] = useState(1);
  const stageRef = useRef<Konva.Stage>(null);
  const [selectedTable, setSelectedTable] = useState<any>(null);

  const layout = event.venueLayout;
  const tables = (layout as any)?.tables || (layout as any)?.placedTables || [];
  const stageElements = (layout as any)?.stageElements || [];

  // Masa tıklama handler
  const handleTableSelect = (tableId: string) => {
    const table = tables.find((t: any) => t.id === tableId);
    if (table) {
      const reservation = reservations.find(
        (r) =>
          r.tableId === tableId &&
          r.status !== "cancelled" &&
          r.status !== "no_show"
      );

      // Label oluştur
      let displayLabel = table.label;
      if (!displayLabel && table.tableNumber) {
        displayLabel = `Masa ${table.tableNumber}`;
      }
      if (!displayLabel) {
        const idParts = table.id.split("-");
        const lastPart = idParts[idParts.length - 1];
        displayLabel = `Masa ${lastPart}`;
      }

      setSelectedTable({ ...table, reservation, displayLabel });
    }
    onTableClick?.(tableId);
  };

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
  const padding = 20;

  const fitZoom = Math.min(
    (containerSize.width - padding * 2) / contentWidth,
    (containerSize.height - padding * 2) / contentHeight,
    1.5
  );

  const offsetX =
    (containerSize.width - contentWidth * zoom * fitZoom) / 2 -
    contentBounds.minX * zoom * fitZoom;
  const offsetY =
    (containerSize.height - contentHeight * zoom * fitZoom) / 2 -
    contentBounds.minY * zoom * fitZoom;

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    setZoom((prev) => {
      const newZoom = e.evt.deltaY > 0 ? prev / scaleBy : prev * scaleBy;
      return Math.max(0.5, Math.min(3, newZoom));
    });
  }, []);

  // Masa render - KÜÇÜLTÜLMÜŞ BOYUTLAR
  const renderTable = (table: any) => {
    const colors = getTableColors(table.id, reservations);
    const reservation = reservations.find(
      (r) =>
        r.tableId === table.id &&
        r.status !== "cancelled" &&
        r.status !== "no_show"
    );
    const typeName =
      table.typeName?.toLowerCase() || table.type?.toLowerCase() || "";
    const isLoca = typeName.includes("loca") || typeName.includes("vip");
    // Küçültülmüş boyutlar: 50->35, 40->28
    const size = isLoca ? 35 : 28;

    return (
      <Group
        key={table.id}
        x={table.x}
        y={table.y}
        rotation={table.rotation || 0}
        onClick={() => handleTableSelect(table.id)}
        onTap={() => handleTableSelect(table.id)}
        style={{ cursor: "pointer" }}
      >
        {isLoca ? (
          <Rect
            width={size}
            height={size * 0.7}
            offsetX={size / 2}
            offsetY={(size * 0.7) / 2}
            fill={colors.fill}
            stroke={colors.stroke}
            strokeWidth={1.5}
            cornerRadius={4}
          />
        ) : (
          <Circle
            radius={size / 2}
            fill={colors.fill}
            stroke={colors.stroke}
            strokeWidth={1.5}
          />
        )}

        {/* Masa etiketi */}
        <Text
          text={table.label || ""}
          fontSize={9}
          fontStyle="bold"
          fill="#fff"
          align="center"
          verticalAlign="middle"
          offsetX={(table.label?.length || 1) * 2.5}
          offsetY={4}
        />
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

  // Stage Elements render
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

  // Rezervasyon durumuna göre masa rengi (3D için)
  const getTableColorFor3D = (tableId: string) => {
    const reservation = reservations.find(
      (r) =>
        r.tableId === tableId &&
        r.status !== "cancelled" &&
        r.status !== "no_show"
    );

    if (!reservation) {
      return "#22C55E"; // Yeşil - Boş
    }

    switch (reservation.status) {
      case "confirmed":
        return "#DC2626"; // Kırmızı - Dolu
      case "pending":
        return "#F59E0B"; // Sarı - Beklemede
      case "checked_in":
        return "#3B82F6"; // Mavi - Giriş yapıldı
      default:
        return "#22C55E";
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-slate-900 rounded-lg overflow-hidden relative"
    >
      {/* Seçili Masa Bilgi Popup */}
      {selectedTable && (
        <div className="absolute top-3 left-3 z-30 bg-slate-800/95 backdrop-blur-sm border border-slate-600 rounded-lg p-3 min-w-[180px] shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-white">
              {selectedTable.displayLabel}
            </span>
            <button
              onClick={() => setSelectedTable(null)}
              className="p-1 hover:bg-slate-700 rounded transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Tip:</span>
              <span className="text-white">
                {selectedTable.typeName || "Standart"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Kapasite:</span>
              <span className="text-white">
                {selectedTable.capacity || 0} Kişi
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Durum:</span>
              <span
                className={
                  selectedTable.reservation
                    ? statusLabels[selectedTable.reservation.status]?.color ||
                      "text-white"
                    : statusLabels.available.color
                }
              >
                {selectedTable.reservation
                  ? statusLabels[selectedTable.reservation.status]?.label ||
                    selectedTable.reservation.status
                  : "Boş"}
              </span>
            </div>
            {selectedTable.reservation && (
              <>
                <div className="border-t border-slate-600 my-2" />
                <div className="flex justify-between">
                  <span className="text-slate-400">Misafir:</span>
                  <span className="text-white truncate max-w-[100px]">
                    {selectedTable.reservation.customer?.fullName ||
                      selectedTable.reservation.guestName ||
                      "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Kişi:</span>
                  <span className="text-white">
                    {selectedTable.reservation.guestCount}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
            const typeName =
              t.typeName?.toLowerCase() || t.type?.toLowerCase() || "";
            const isLoca =
              typeName.includes("loca") || typeName.includes("vip");

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
              color: getTableColorFor3D(t.id),
              shape: isLoca ? "square" : "round",
              label: displayLabel,
              floor: isLoca ? 2 : 1,
            };
          })}
          servicePoints={[]}
          tableGroups={[]}
          teams={[]}
          viewMode="step1"
          selectedTableIds={[]}
          onTableClick={handleTableSelect}
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
              <Rect
                x={0}
                y={0}
                width={layout?.width || 800}
                height={layout?.height || 600}
                fill="#0f172a"
              />
              {renderZones()}
              {renderWalls()}
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
              {renderStageElements()}
              {tables.map(renderTable)}
            </Layer>
          </Stage>
        </div>
      )}
    </div>
  );
}
