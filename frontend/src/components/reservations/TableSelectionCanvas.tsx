"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Stage, Layer, Rect, Circle, Text, Group, Line } from "react-konva";
import type { Event, TableInstance } from "@/types";
import Konva from "konva";

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
  guestInfo?: GuestInfo; // Misafir bilgileri (opsiyonel)
}

export function TableSelectionCanvas({
  event,
  reservedTableIds,
  selectedTableId,
  onSelectTable,
  guestInfo,
}: TableSelectionCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({
    width: 800,
    height: 600,
  });
  const [zoom, setZoom] = useState(1);
  const stageRef = useRef<Konva.Stage>(null);

  const layout = event.venueLayout;
  const tables = layout?.tables || [];

  // Container boyutunu takip et
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

  // İçeriğin gerçek bounding box'ını hesapla (boş alanları kaldırmak için)
  const contentBounds = (() => {
    if (!tables.length && !layout?.zones?.length && !layout?.stage) {
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
    const tableSize = 30; // Masa boyutu için margin

    // Masaların sınırlarını hesapla
    tables.forEach((table) => {
      minX = Math.min(minX, table.x - tableSize);
      minY = Math.min(minY, table.y - tableSize);
      maxX = Math.max(maxX, table.x + tableSize);
      maxY = Math.max(maxY, table.y + tableSize);
    });

    // Zone'ların sınırlarını hesapla
    layout?.zones?.forEach((zone) => {
      minX = Math.min(minX, zone.x);
      minY = Math.min(minY, zone.y);
      maxX = Math.max(maxX, zone.x + zone.width);
      maxY = Math.max(maxY, zone.y + zone.height);
    });

    // Sahnenin sınırlarını hesapla
    if (layout?.stage) {
      minX = Math.min(minX, layout.stage.x);
      minY = Math.min(minY, layout.stage.y);
      maxX = Math.max(maxX, layout.stage.x + layout.stage.width);
      maxY = Math.max(maxY, layout.stage.y + layout.stage.height);
    }

    // Duvarların sınırlarını hesapla
    layout?.walls?.forEach((wall) => {
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

  // İçeriğin gerçek boyutları
  const contentWidth = contentBounds.maxX - contentBounds.minX;
  const contentHeight = contentBounds.maxY - contentBounds.minY;
  const padding = 30; // Kenarlardan boşluk

  // Canvas'ın container'a sığması için zoom hesapla
  const fitZoom = Math.min(
    (containerSize.width - padding * 2) / contentWidth,
    (containerSize.height - padding * 2) / contentHeight,
    1.2 // Maksimum zoom
  );

  // Canvas'ı ortalamak için offset hesapla (içeriğin başlangıç noktasını da hesaba kat)
  const scaledWidth = contentWidth * zoom * fitZoom;
  const scaledHeight = contentHeight * zoom * fitZoom;
  const offsetX =
    (containerSize.width - scaledWidth) / 2 -
    contentBounds.minX * zoom * fitZoom;
  const offsetY =
    (containerSize.height - scaledHeight) / 2 -
    contentBounds.minY * zoom * fitZoom;

  // Zoom kontrolü
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    setZoom((prev) => {
      const newZoom = e.evt.deltaY > 0 ? prev / scaleBy : prev * scaleBy;
      return Math.max(0.5, Math.min(3, newZoom));
    });
  }, []);

  // Masa tıklama
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
    const isLoca =
      table.typeName?.toLowerCase() === "loca" || table.typeId === "loca";
    const size = isLoca ? 50 : 40;

    // Renk belirleme
    let fillColor = table.color || "#3B82F6";
    let strokeColor = "#64748b";

    if (isReserved) {
      fillColor = "#DC2626"; // Kırmızı - rezerveli
      strokeColor = "#991B1B";
    } else if (isSelected) {
      fillColor = "#3B82F6"; // Mavi - seçili
      strokeColor = "#60A5FA"; // Açık mavi border
    } else {
      // Müsait - yeşil çerçeve
      fillColor = "#22C55E20"; // Hafif yeşil arka plan
      strokeColor = "#22C55E";
    }

    return (
      <Group
        key={table.id}
        x={table.x}
        y={table.y}
        rotation={table.rotation || 0}
        onClick={() => handleTableClick(table)}
        onTap={() => handleTableClick(table)}
        style={{ cursor: isReserved ? "not-allowed" : "pointer" }}
      >
        {/* Seçili masa için glow efekti */}
        {isSelected && !isLoca && (
          <Circle
            radius={size / 2 + 6}
            fill="transparent"
            stroke="#3B82F6"
            strokeWidth={2}
            opacity={0.5}
          />
        )}
        {isSelected && isLoca && (
          <Rect
            width={size + 12}
            height={size * 0.7 + 12}
            offsetX={(size + 12) / 2}
            offsetY={(size * 0.7 + 12) / 2}
            fill="transparent"
            stroke="#3B82F6"
            strokeWidth={2}
            cornerRadius={8}
            opacity={0.5}
          />
        )}

        {isLoca ? (
          <Rect
            width={size}
            height={size * 0.7}
            offsetX={size / 2}
            offsetY={(size * 0.7) / 2}
            fill={isSelected ? fillColor : isReserved ? fillColor : fillColor}
            stroke={strokeColor}
            strokeWidth={isSelected ? 3 : isReserved ? 2 : 2}
            cornerRadius={6}
          />
        ) : (
          <Circle
            radius={size / 2}
            fill={isReserved ? fillColor : isSelected ? fillColor : fillColor}
            stroke={strokeColor}
            strokeWidth={isSelected ? 3 : isReserved ? 2 : 2}
          />
        )}

        {/* Masa etiketi veya R harfi */}
        <Text
          text={isReserved ? "R" : table.label}
          fontSize={isReserved ? 16 : 11}
          fontStyle="bold"
          fill={isReserved ? "#fff" : isSelected ? "#fff" : "#e2e8f0"}
          align="center"
          verticalAlign="middle"
          offsetX={isReserved ? 5 : (table.label?.length || 1) * 3}
          offsetY={isLoca ? 4 : 5}
        />

        {/* Kapasite (müsait ve seçili masalar için) */}
        {!isReserved && (
          <Text
            text={`${table.capacity}k`}
            fontSize={8}
            fill={isSelected ? "#93C5FD" : "#94a3b8"}
            align="center"
            offsetX={7}
            offsetY={isLoca ? -6 : -10}
          />
        )}
      </Group>
    );
  };

  // Zone render (sahne, bar vb.)
  const renderZones = () => {
    if (!layout?.zones) return null;
    return layout.zones.map((zone) => (
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
    return layout.walls.map((wall) => (
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
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Tel:</span>
                <span className="text-slate-300">{guestInfo.phone}</span>
              </div>
              {guestInfo.email && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">E-posta:</span>
                  <span className="text-slate-300">{guestInfo.email}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 bg-blue-600/20 px-3 py-1 rounded-full">
              <span className="text-blue-400 font-medium">
                {guestInfo.guestCount} Kişi
              </span>
            </div>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="w-full h-[500px] bg-slate-900 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing"
      >
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

            {/* Sahne */}
            {layout?.stage && (
              <Group x={layout.stage.x} y={layout.stage.y}>
                <Rect
                  width={layout.stage.width}
                  height={layout.stage.height}
                  fill="#1e293b"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  cornerRadius={8}
                />
                <Text
                  y={layout.stage.height / 2 - 10}
                  width={layout.stage.width}
                  text={layout.stage.label || "SAHNE"}
                  fontSize={16}
                  fontStyle="bold"
                  fill="#fff"
                  align="center"
                />
              </Group>
            )}

            {/* Masalar */}
            {tables.map(renderTable)}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
