'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Stage, Layer, Rect, Circle, Text, Group, Line, Transformer } from 'react-konva';
import { useCanvasStore } from '@/store/canvas-store';
import { TableInstance } from '@/types';
import { generateId } from '@/lib/utils';
import Konva from 'konva';

// Etiket renkleri
const LABEL_COLORS: Record<string, string> = {
  stage: '#3b82f6',
  bar: '#f97316',
  entrance: '#22c55e',
  exit: '#ef4444',
  dj: '#8b5cf6',
  wc: '#64748b',
};

const LABEL_NAMES: Record<string, string> = {
  stage: 'SAHNE',
  bar: 'BAR',
  entrance: 'GİRİŞ',
  exit: 'ÇIKIŞ',
  dj: 'DJ',
  wc: 'WC',
};

interface EventCanvasProps {
  eventId?: string;
  readOnly?: boolean;
  onTableSelect?: (table: TableInstance | null) => void;
}

export function EventCanvas({ readOnly = false, onTableSelect }: EventCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const stageShapeRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; wallId: string } | null>(null);
  
  // Pan (kaydırma) için state
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  
  // Box selection için state
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  
  // Toplu hareket için state
  const [isDraggingGroup, setIsDraggingGroup] = useState(false);
  const [groupDragStart, setGroupDragStart] = useState({ x: 0, y: 0 });
  
  const {
    tables,
    layout,
    zoom,
    setZoom,
    gridEnabled,
    selectedTableIds,
    setSelectedTableIds,
    toggleTableSelection,
    updateTable,
    activeTool,
    stageSelected,
    setStageSelected,
    updateStage,
    walls,
    addWall,
    removeWall,
    isDrawing,
    setIsDrawing,
    currentDrawingPoints,
    setCurrentDrawingPoints,
    selectedWallId,
    setSelectedWallId,
    setWallLabel,
    createStageFromWall,
  } = useCanvasStore();

  // Grid çizimi - performans için optimize edildi (daha büyük aralıklar)
  const renderGrid = useCallback(() => {
    if (!gridEnabled) return null;
    const lines = [];
    // Performans için grid aralığını artır
    const gridSize = layout.gridSize * 2;
    
    // Dikey çizgiler
    for (let i = 0; i <= layout.width; i += gridSize) {
      lines.push(
        <Line
          key={`v-${i}`}
          points={[i, 0, i, layout.height]}
          stroke="#334155"
          strokeWidth={0.5}
          opacity={0.2}
          perfectDrawEnabled={false}
          listening={false}
        />
      );
    }
    
    // Yatay çizgiler
    for (let i = 0; i <= layout.height; i += gridSize) {
      lines.push(
        <Line
          key={`h-${i}`}
          points={[0, i, layout.width, i]}
          stroke="#334155"
          strokeWidth={0.5}
          opacity={0.2}
          perfectDrawEnabled={false}
          listening={false}
        />
      );
    }
    return lines;
  }, [gridEnabled, layout.gridSize, layout.width, layout.height]);

  // Sahne sürükleme
  const handleStageDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    if (readOnly) return;
    const node = e.target;
    let x = node.x();
    let y = node.y();
    
    // Grid snap
    if (gridEnabled) {
      x = Math.round(x / layout.gridSize) * layout.gridSize;
      y = Math.round(y / layout.gridSize) * layout.gridSize;
    }
    
    updateStage({ x, y });
  }, [readOnly, gridEnabled, layout.gridSize, updateStage]);

  // Sahne boyutlandırma
  const handleStageTransformEnd = useCallback(() => {
    if (!stageShapeRef.current) return;
    const node = stageShapeRef.current;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    
    // Scale'i sıfırla ve boyutları güncelle
    node.scaleX(1);
    node.scaleY(1);
    
    let newWidth = Math.max(50, (layout.stage?.width || 200) * scaleX);
    let newHeight = Math.max(30, (layout.stage?.height || 80) * scaleY);
    
    // Grid snap
    if (gridEnabled) {
      newWidth = Math.round(newWidth / layout.gridSize) * layout.gridSize;
      newHeight = Math.round(newHeight / layout.gridSize) * layout.gridSize;
    }
    
    updateStage({ width: newWidth, height: newHeight });
  }, [gridEnabled, layout.gridSize, layout.stage, updateStage]);

  // Sahne tıklama
  const handleStageShapeClick = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true;
    setSelectedTableIds([]);
    setStageSelected(true);
    onTableSelect?.(null);
  }, [setSelectedTableIds, setStageSelected, onTableSelect]);

  // Transformer'ı sahneye bağla
  useEffect(() => {
    if (stageSelected && transformerRef.current && stageShapeRef.current) {
      transformerRef.current.nodes([stageShapeRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [stageSelected]);

  // Sahne çizimi
  const renderStage = () => {
    if (!layout.stage) return null;
    const { x, y, width, height, label } = layout.stage;
    return (
      <Group
        ref={stageShapeRef}
        x={x}
        y={y}
        draggable={!readOnly && activeTool === 'select'}
        onDragEnd={handleStageDragEnd}
        onClick={handleStageShapeClick}
        onTap={handleStageShapeClick}
      >
        <Rect
          width={width}
          height={height}
          fill="#1e293b"
          stroke={stageSelected ? '#fff' : '#3b82f6'}
          strokeWidth={stageSelected ? 3 : 2}
          cornerRadius={8}
          shadowColor="blue"
          shadowBlur={stageSelected ? 15 : 5}
          shadowOpacity={0.5}
        />
        <Text
          y={height / 2 - 10}
          width={width}
          text={label || 'SAHNE'}
          fontSize={18}
          fontStyle="bold"
          fill="#fff"
          align="center"
        />
      </Group>
    );
  };

  // Masa sürükleme
  const handleTableDragEnd = useCallback((tableId: string, e: Konva.KonvaEventObject<DragEvent>) => {
    if (readOnly) return;
    const node = e.target;
    let x = node.x();
    let y = node.y();
    
    // Grid snap
    if (gridEnabled) {
      x = Math.round(x / layout.gridSize) * layout.gridSize;
      y = Math.round(y / layout.gridSize) * layout.gridSize;
    }
    
    updateTable(tableId, { x, y });
  }, [readOnly, gridEnabled, layout.gridSize, updateTable]);

  // Masa tıklama
  const handleTableClick = useCallback((table: TableInstance, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true;
    
    const isShiftKey = 'shiftKey' in e.evt && e.evt.shiftKey;
    if (isShiftKey) {
      toggleTableSelection(table.id);
    } else if (!selectedTableIds.includes(table.id)) {
      // Seçili değilse tek seç
      setSelectedTableIds([table.id]);
    }
    // Zaten seçiliyse seçimi koru (toplu hareket için)
    
    onTableSelect?.(table);
  }, [toggleTableSelection, setSelectedTableIds, selectedTableIds, onTableSelect]);

  // Toplu masa sürükleme
  const handleGroupDragStart = useCallback((tableId: string, e: Konva.KonvaEventObject<DragEvent>) => {
    if (selectedTableIds.length > 1 && selectedTableIds.includes(tableId)) {
      setIsDraggingGroup(true);
      const node = e.target;
      // Sürüklenen masanın başlangıç pozisyonunu kaydet
      setGroupDragStart({ x: node.x(), y: node.y() });
    }
  }, [selectedTableIds]);

  const handleGroupDragMove = useCallback((tableId: string, e: Konva.KonvaEventObject<DragEvent>) => {
    if (!isDraggingGroup || selectedTableIds.length <= 1) return;
    
    const node = e.target;
    const currentX = node.x();
    const currentY = node.y();
    
    // Hareket miktarını hesapla
    const dx = currentX - groupDragStart.x;
    const dy = currentY - groupDragStart.y;
    
    if (dx === 0 && dy === 0) return;
    
    // Diğer seçili masaları da hareket ettir
    selectedTableIds.forEach((id) => {
      if (id !== tableId) {
        const t = tables.find((tb) => tb.id === id);
        if (t) {
          updateTable(id, { x: t.x + dx, y: t.y + dy });
        }
      }
    });
    
    // Yeni başlangıç noktasını güncelle
    setGroupDragStart({ x: currentX, y: currentY });
  }, [isDraggingGroup, selectedTableIds, groupDragStart, tables, updateTable]);

  const handleGroupDragEnd = useCallback((tableId: string, e: Konva.KonvaEventObject<DragEvent>) => {
    if (readOnly) return;
    
    const node = e.target;
    let x = node.x();
    let y = node.y();
    
    // Grid snap
    if (gridEnabled) {
      x = Math.round(x / layout.gridSize) * layout.gridSize;
      y = Math.round(y / layout.gridSize) * layout.gridSize;
    }
    
    updateTable(tableId, { x, y });
    
    // Toplu hareket bitişi - diğer masaları da grid'e snap et
    if (isDraggingGroup && selectedTableIds.length > 1) {
      selectedTableIds.forEach((id) => {
        if (id !== tableId) {
          const t = tables.find((tb) => tb.id === id);
          if (t && gridEnabled) {
            updateTable(id, {
              x: Math.round(t.x / layout.gridSize) * layout.gridSize,
              y: Math.round(t.y / layout.gridSize) * layout.gridSize,
            });
          }
        }
      });
    }
    
    setIsDraggingGroup(false);
  }, [readOnly, gridEnabled, layout.gridSize, updateTable, isDraggingGroup, selectedTableIds, tables]);

  // Masa çizimi - büyütülmüş boyut
  const renderTable = useCallback((table: TableInstance) => {
    const isSelected = selectedTableIds.includes(table.id);
    // Loca masaları dikdörtgen, diğerleri yuvarlak
    const isLoca = table.typeName?.toLowerCase() === 'loca' || table.typeId === 'loca';
    const size = isLoca ? 50 : 36; // Büyütülmüş boyut
    
    return (
      <Group
        key={table.id}
        x={table.x}
        y={table.y}
        rotation={table.rotation}
        draggable={!readOnly && activeTool === 'select' && !isLoca}
        onDragStart={(e) => !isLoca && handleGroupDragStart(table.id, e)}
        onDragMove={(e) => !isLoca && handleGroupDragMove(table.id, e)}
        onDragEnd={(e) => !isLoca && handleGroupDragEnd(table.id, e)}
        onClick={(e) => handleTableClick(table, e)}
        onTap={(e) => handleTableClick(table, e)}
        perfectDrawEnabled={false}
        listening={true}
      >
        {isLoca ? (
          // Loca masaları - dikdörtgen
          <Rect
            width={size}
            height={size * 0.7}
            offsetX={size / 2}
            offsetY={(size * 0.7) / 2}
            fill={table.staffColor || table.color}
            stroke={isSelected ? '#fff' : '#dc2626'}
            strokeWidth={isSelected ? 3 : 2}
            cornerRadius={6}
            perfectDrawEnabled={false}
          />
        ) : (
          // Normal masalar - yuvarlak (büyütülmüş)
          <Circle
            radius={size / 2}
            fill={table.staffColor || table.color}
            stroke={isSelected ? '#fff' : '#64748b'}
            strokeWidth={isSelected ? 3 : 1.5}
            perfectDrawEnabled={false}
          />
        )}
        <Text
          text={table.label}
          fontSize={isLoca ? 12 : 11}
          fontStyle="bold"
          fill="#1e3a5f"
          align="center"
          verticalAlign="middle"
          offsetX={table.label.length * (isLoca ? 3.5 : 3)}
          offsetY={isLoca ? 5 : 4}
          perfectDrawEnabled={false}
        />
      </Group>
    );
  }, [selectedTableIds, readOnly, activeTool, handleGroupDragStart, handleGroupDragMove, handleGroupDragEnd, handleTableClick]);

  // Zoom kontrolü
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    const newZoom = e.evt.deltaY > 0 ? zoom / scaleBy : zoom * scaleBy;
    setZoom(newZoom);
  }, [zoom, setZoom]);

  // Grid'e snap fonksiyonu
  const snapToGridValue = useCallback((value: number) => {
    if (!gridEnabled) return value;
    return Math.round(value / layout.gridSize) * layout.gridSize;
  }, [gridEnabled, layout.gridSize]);

  // Çizgi çizme - Mouse down
  const handleDrawStart = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool !== 'draw' || readOnly) return;
    
    const stage = e.target.getStage();
    if (!stage) return;
    
    const pos = stage.getPointerPosition();
    if (!pos) return;
    
    // Zoom'u hesaba kat
    const x = snapToGridValue(pos.x / zoom);
    const y = snapToGridValue(pos.y / zoom);
    
    setIsDrawing(true);
    setCurrentDrawingPoints([x, y, x, y]);
  }, [activeTool, readOnly, zoom, snapToGridValue, setIsDrawing, setCurrentDrawingPoints]);

  // Çizgi çizme - Mouse move
  const handleDrawMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing || activeTool !== 'draw') return;
    
    const stage = e.target.getStage();
    if (!stage) return;
    
    const pos = stage.getPointerPosition();
    if (!pos) return;
    
    // Zoom'u hesaba kat ve grid'e snap
    const x = snapToGridValue(pos.x / zoom);
    const y = snapToGridValue(pos.y / zoom);
    
    // Sadece son noktayı güncelle (düz çizgi için)
    const points = [...currentDrawingPoints];
    points[points.length - 2] = x;
    points[points.length - 1] = y;
    setCurrentDrawingPoints(points);
  }, [isDrawing, activeTool, zoom, snapToGridValue, currentDrawingPoints, setCurrentDrawingPoints]);

  // Çizgi çizme - Mouse up
  const handleDrawEnd = useCallback(() => {
    if (!isDrawing || activeTool !== 'draw') return;
    
    // Minimum uzunluk kontrolü
    if (currentDrawingPoints.length >= 4) {
      const dx = currentDrawingPoints[2] - currentDrawingPoints[0];
      const dy = currentDrawingPoints[3] - currentDrawingPoints[1];
      const length = Math.sqrt(dx * dx + dy * dy);
      
      if (length > 10) {
        addWall({
          id: generateId(),
          points: currentDrawingPoints,
          strokeWidth: 4,
          color: '#64748b',
        });
      }
    }
    
    setIsDrawing(false);
    setCurrentDrawingPoints([]);
  }, [isDrawing, activeTool, currentDrawingPoints, addWall, setIsDrawing, setCurrentDrawingPoints]);

  // Pan (kaydırma) - Mouse down
  const handlePanStart = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool !== 'pan') return;
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    setIsPanning(true);
    setLastPanPoint({ x: pos.x, y: pos.y });
  }, [activeTool]);

  // Pan - Mouse move
  const handlePanMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isPanning || activeTool !== 'pan') return;
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    
    const dx = pos.x - lastPanPoint.x;
    const dy = pos.y - lastPanPoint.y;
    
    setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastPanPoint({ x: pos.x, y: pos.y });
  }, [isPanning, activeTool, lastPanPoint]);

  // Pan - Mouse up
  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Duvar tıklama
  const handleWallClick = useCallback((wallId: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true;
    if (activeTool === 'eraser') {
      removeWall(wallId);
    } else if (activeTool === 'select') {
      setSelectedWallId(wallId);
      setSelectedTableIds([]);
      setStageSelected(false);
    }
  }, [activeTool, removeWall, setSelectedWallId, setSelectedTableIds, setStageSelected]);

  // Duvar sürükleme
  const handleWallDragEnd = useCallback((wallId: string, e: Konva.KonvaEventObject<DragEvent>) => {
    if (readOnly) return;
    const node = e.target;
    let dx = node.x();
    let dy = node.y();
    
    // Grid snap
    if (gridEnabled) {
      dx = Math.round(dx / layout.gridSize) * layout.gridSize;
      dy = Math.round(dy / layout.gridSize) * layout.gridSize;
    }
    
    // Pozisyonu sıfırla ve noktaları güncelle
    node.x(0);
    node.y(0);
    
    const wall = walls.find((w) => w.id === wallId);
    if (wall) {
      const newPoints = wall.points.map((p, i) => {
        return i % 2 === 0 ? p + dx : p + dy;
      });
      useCanvasStore.getState().updateWall(wallId, { points: newPoints });
    }
  }, [readOnly, gridEnabled, layout.gridSize, walls]);

  // Duvar sağ tıklama (context menu)
  const handleWallContextMenu = useCallback((wallId: string, e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    e.cancelBubble = true;
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    setContextMenu({ x: pos.x, y: pos.y, wallId });
    setSelectedWallId(wallId);
  }, [setSelectedWallId]);

  // Context menu kapat
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Duvarları render et
  const renderWalls = () => {
    return walls.map((wall) => {
      const isSelected = selectedWallId === wall.id;
      const labelColor = wall.label ? LABEL_COLORS[wall.label] : wall.color;
      
      // Etiket için orta nokta hesapla
      const midX = (wall.points[0] + wall.points[2]) / 2;
      const midY = (wall.points[1] + wall.points[3]) / 2;
      
      return (
        <Group
          key={wall.id}
          draggable={!readOnly && activeTool === 'select'}
          onDragEnd={(e) => handleWallDragEnd(wall.id, e)}
        >
          <Line
            points={wall.points}
            stroke={isSelected ? '#fff' : labelColor}
            strokeWidth={isSelected ? 6 : wall.strokeWidth}
            lineCap="round"
            lineJoin="round"
            hitStrokeWidth={20}
            onClick={(e) => handleWallClick(wall.id, e)}
            onTap={(e) => handleWallClick(wall.id, e)}
            onContextMenu={(e) => handleWallContextMenu(wall.id, e)}
          />
          {/* Etiket badge */}
          {wall.label && (
            <Group x={midX} y={midY - 15}>
              <Rect
                x={-25}
                y={-10}
                width={50}
                height={20}
                fill={labelColor}
                cornerRadius={4}
              />
              <Text
                x={-25}
                y={-6}
                width={50}
                text={LABEL_NAMES[wall.label] || wall.label}
                fontSize={10}
                fontStyle="bold"
                fill="#fff"
                align="center"
              />
            </Group>
          )}
        </Group>
      );
    });
  };

  // Çizim sırasındaki geçici çizgi
  const renderCurrentDrawing = () => {
    if (!isDrawing || currentDrawingPoints.length < 4) return null;
    return (
      <Line
        points={currentDrawingPoints}
        stroke="#3b82f6"
        strokeWidth={4}
        lineCap="round"
        dash={[10, 5]}
      />
    );
  };

  // Canvas tıklama (seçimi temizle)
  const handleCanvasClick = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage()) {
      setSelectedTableIds([]);
      setStageSelected(false);
      setSelectedWallId(null);
      closeContextMenu();
      onTableSelect?.(null);
    }
  }, [setSelectedTableIds, setStageSelected, setSelectedWallId, closeContextMenu, onTableSelect]);

  // Container boyutunu hesapla
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: layout.width, height: layout.height });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Canvas'ın container'a sığması için zoom hesapla
  const fitZoom = Math.min(
    containerSize.width / layout.width,
    containerSize.height / layout.height,
    1
  );

  // Canvas'ı ortalamak için offset hesapla
  const scaledWidth = layout.width * zoom * fitZoom;
  const scaledHeight = layout.height * zoom * fitZoom;
  const baseOffsetX = Math.max(0, (containerSize.width - scaledWidth) / 2);
  const baseOffsetY = Math.max(0, (containerSize.height - scaledHeight) / 2);

  // Cursor belirleme
  const getCursor = () => {
    if (activeTool === 'draw') return 'crosshair';
    if (activeTool === 'pan') return isPanning ? 'grabbing' : 'grab';
    if (isSelecting) return 'crosshair';
    return 'default';
  };

  // Box selection - masaları seç (sol tuş basılı tutarak sürükle)
  const handleBoxSelectionStart = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // Sadece select modunda çalış
    if (activeTool !== 'select') return;
    
    // Eğer bir masaya tıklandıysa box selection başlatma
    const target = e.target;
    const targetName = target.getClassName();
    
    // Circle veya Rect (masa) ise box selection başlatma
    if (targetName === 'Circle' || (targetName === 'Rect' && target.attrs?.id !== 'canvas-background')) {
      // Frame rect'leri hariç
      if (target.attrs?.fill !== 'transparent' && target.attrs?.fill !== '#0f172a') {
        return;
      }
    }
    
    const stage = target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    
    // Stage koordinatlarına çevir (scale hesaba katılarak)
    const scale = zoom * fitZoom;
    const x = (pos.x - baseOffsetX - panOffset.x) / scale;
    const y = (pos.y - baseOffsetY - panOffset.y) / scale;
    
    console.log('Box selection başladı:', { x, y, scale });
    
    setIsSelecting(true);
    setSelectionStart({ x, y });
    setSelectionBox({ x, y, width: 0, height: 0 });
  }, [activeTool, baseOffsetX, baseOffsetY, panOffset, zoom, fitZoom]);

  const handleBoxSelectionMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isSelecting) return;
    
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    
    const scale = zoom * fitZoom;
    const currentX = (pos.x - baseOffsetX - panOffset.x) / scale;
    const currentY = (pos.y - baseOffsetY - panOffset.y) / scale;
    
    // Selection box hesapla (negatif boyutları düzelt)
    const x = Math.min(selectionStart.x, currentX);
    const y = Math.min(selectionStart.y, currentY);
    const width = Math.abs(currentX - selectionStart.x);
    const height = Math.abs(currentY - selectionStart.y);
    
    setSelectionBox({ x, y, width, height });
  }, [isSelecting, selectionStart, baseOffsetX, baseOffsetY, panOffset, zoom, fitZoom]);

  const handleBoxSelectionEnd = useCallback(() => {
    if (!isSelecting || !selectionBox) {
      setIsSelecting(false);
      setSelectionBox(null);
      return;
    }
    
    // Minimum boyut kontrolü (çok küçük seçimler için)
    if (selectionBox.width < 5 && selectionBox.height < 5) {
      setIsSelecting(false);
      setSelectionBox(null);
      return;
    }
    
    // Selection box içindeki masaları bul
    const selectedIds: string[] = [];
    tables.forEach((table) => {
      // Masa merkezi selection box içinde mi?
      if (
        table.x >= selectionBox.x &&
        table.x <= selectionBox.x + selectionBox.width &&
        table.y >= selectionBox.y &&
        table.y <= selectionBox.y + selectionBox.height
      ) {
        selectedIds.push(table.id);
      }
    });
    
    console.log('Box selection bitti:', { box: selectionBox, selectedCount: selectedIds.length });
    
    if (selectedIds.length > 0) {
      setSelectedTableIds(selectedIds);
    }
    
    setIsSelecting(false);
    setSelectionBox(null);
  }, [isSelecting, selectionBox, tables, setSelectedTableIds]);

  // Mouse event handler'ları birleştir
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool === 'pan') handlePanStart(e);
    else if (activeTool === 'draw') handleDrawStart(e);
    else if (activeTool === 'select') handleBoxSelectionStart(e);
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool === 'pan') handlePanMove(e);
    else if (activeTool === 'draw') handleDrawMove(e);
    else if (isSelecting) handleBoxSelectionMove(e);
  };

  const handleMouseUp = () => {
    if (activeTool === 'pan') handlePanEnd();
    else if (activeTool === 'draw') handleDrawEnd();
    else if (isSelecting) handleBoxSelectionEnd();
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
      <Stage
        ref={stageRef}
        x={baseOffsetX + panOffset.x}
        y={baseOffsetY + panOffset.y}
        width={containerSize.width}
        height={containerSize.height}
        scaleX={zoom * fitZoom}
        scaleY={zoom * fitZoom}
        onWheel={handleWheel}
        onClick={handleCanvasClick}
        onTap={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: getCursor() }}
      >
        <Layer>
          {/* Arkaplan - box selection için tıklanabilir */}
          <Rect
            x={0}
            y={0}
            width={layout.width}
            height={layout.height}
            fill="#0f172a"
            listening={true}
            id="canvas-background"
          />
          
          {/* Grid */}
          {renderGrid()}
          
          {/* Zones (System Kontrol, Loca, Sahne vb.) */}
          {layout.zones?.map((zone) => {
            const isLoca = zone.type === 'loca';
            const isStage = zone.type === 'stage';
            const isStageExtension = zone.type === 'stage-extension';
            const isStageEnd = zone.type === 'stage-end';
            const isInfo = zone.type === 'info';
            const isSystem = zone.type === 'system';
            const isFrame = zone.type === 'frame';
            
            // Ana çerçeve - sadece kırmızı border
            if (isFrame) {
              return (
                <Group key={zone.id} x={zone.x} y={zone.y}>
                  <Rect
                    width={zone.width}
                    height={zone.height}
                    fill="transparent"
                    stroke="#dc2626"
                    strokeWidth={3}
                  />
                </Group>
              );
            }
            
            // Sahne üst kısmı - açık mavi, kırmızı çerçeve
            if (isStage) {
              return (
                <Group key={zone.id} x={zone.x} y={zone.y}>
                  <Rect
                    width={zone.width}
                    height={zone.height}
                    fill="#1e3a5f"
                    stroke="#dc2626"
                    strokeWidth={3}
                  />
                  <Text
                    y={zone.height / 2 - 12}
                    width={zone.width}
                    text={zone.label}
                    fontSize={20}
                    fontStyle="bold"
                    fill="#fff"
                    align="center"
                  />
                </Group>
              );
            }
            
            // Sahne bilgi kutusu - açık mavi, kırmızı çerçeve
            if (isInfo) {
              return (
                <Group key={zone.id} x={zone.x} y={zone.y}>
                  <Rect
                    width={zone.width}
                    height={zone.height}
                    fill="#93c5fd"
                    stroke="#dc2626"
                    strokeWidth={2}
                  />
                  <Text
                    y={zone.height / 2 - 10}
                    width={zone.width}
                    text={zone.label}
                    fontSize={16}
                    fontStyle="bold"
                    fill="#1e3a5f"
                    align="center"
                  />
                </Group>
              );
            }
            
            // Sahne ön uzantısı - açık mavi
            if (isStageExtension) {
              return (
                <Group key={zone.id} x={zone.x} y={zone.y}>
                  <Rect
                    width={zone.width}
                    height={zone.height}
                    fill="#93c5fd"
                  />
                </Group>
              );
            }
            
            // Sahne ön ucu - kırmızı çerçeveli
            if (isStageEnd) {
              return (
                <Group key={zone.id} x={zone.x} y={zone.y}>
                  <Rect
                    width={zone.width}
                    height={zone.height}
                    fill="#93c5fd"
                    stroke="#dc2626"
                    strokeWidth={3}
                  />
                </Group>
              );
            }
            
            // System Kontrol - kırmızı
            if (isSystem) {
              return (
                <Group key={zone.id} x={zone.x} y={zone.y}>
                  <Rect
                    width={zone.width}
                    height={zone.height}
                    fill="#dc2626"
                    cornerRadius={4}
                  />
                  <Text
                    y={zone.height / 2 - 8}
                    width={zone.width}
                    text={zone.label}
                    fontSize={14}
                    fontStyle="bold"
                    fill="#fff"
                    align="center"
                  />
                </Group>
              );
            }
            
            // Loca alanı - açık kırmızı çerçeve
            if (isLoca) {
              return (
                <Group key={zone.id} x={zone.x} y={zone.y}>
                  <Rect
                    width={zone.width}
                    height={zone.height}
                    fill="#fecaca"
                    opacity={0.3}
                    stroke="#dc2626"
                    strokeWidth={3}
                    cornerRadius={4}
                  />
                  <Text
                    y={zone.height - 20}
                    width={zone.width}
                    text={zone.label}
                    fontSize={16}
                    fontStyle="bold"
                    fill="#dc2626"
                    align="center"
                  />
                </Group>
              );
            }
            
            // Diğer zone'lar
            return (
              <Group key={zone.id} x={zone.x} y={zone.y}>
                <Rect
                  width={zone.width}
                  height={zone.height}
                  fill={zone.color}
                  opacity={0.8}
                  cornerRadius={4}
                />
                {zone.label && (
                  <Text
                    y={zone.height / 2 - 8}
                    width={zone.width}
                    text={zone.label}
                    fontSize={14}
                    fontStyle="bold"
                    fill="#fff"
                    align="center"
                  />
                )}
              </Group>
            );
          })}
          
          {/* Duvarlar/Çizgiler */}
          {renderWalls()}
          
          {/* Çizim sırasındaki geçici çizgi */}
          {renderCurrentDrawing()}
          
          {/* Sahne - artık zone olarak render ediliyor, eski renderStage kaldırıldı */}
          
          {/* Masalar */}
          {tables.map(renderTable)}
          
          {/* Box Selection Rectangle */}
          {isSelecting && selectionBox && (
            <Rect
              x={selectionBox.x}
              y={selectionBox.y}
              width={selectionBox.width}
              height={selectionBox.height}
              fill="rgba(59, 130, 246, 0.2)"
              stroke="#3b82f6"
              strokeWidth={1}
              dash={[5, 5]}
              listening={false}
            />
          )}
          
          {/* Sahne Transformer (boyutlandırma için) */}
          {stageSelected && layout.stage && (
            <Transformer
              ref={transformerRef}
              boundBoxFunc={(oldBox, newBox) => {
                // Minimum boyut kontrolü
                if (newBox.width < 50 || newBox.height < 30) {
                  return oldBox;
                }
                return newBox;
              }}
              onTransformEnd={handleStageTransformEnd}
            />
          )}
        </Layer>
      </Stage>
      
      {/* Zoom göstergesi */}
      <div className="absolute bottom-4 right-4 bg-slate-800 px-3 py-1 rounded text-sm text-white">
        {Math.round(zoom * 100)}%
      </div>
      
      {/* Aktif araç göstergesi */}
      {activeTool === 'draw' && (
        <div className="absolute top-4 left-4 bg-blue-600 px-3 py-1 rounded text-sm text-white">
          Çizgi çizme modu - Grid&apos;e hizalı
        </div>
      )}

      {/* Seçili çizgi göstergesi */}
      {selectedWallId && activeTool === 'select' && (
        <div className="absolute top-4 left-4 bg-purple-600 px-3 py-1 rounded text-sm text-white">
          Çizgi seçili - Toolbar&apos;dan etiket ekleyebilirsiniz
        </div>
      )}

      {/* Sağ tıklama menüsü */}
      {contextMenu && (
        <div
          className="absolute bg-slate-800 rounded-lg shadow-xl border border-slate-600 py-2 z-50"
          style={{ left: contextMenu.x * zoom, top: contextMenu.y * zoom }}
        >
          <button
            onClick={() => {
              createStageFromWall(contextMenu.wallId);
              closeContextMenu();
            }}
            className="w-full px-4 py-2 text-left text-sm text-white flex items-center gap-2"
          >
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            Sahne Yap
          </button>
          <button
            onClick={() => {
              setWallLabel(contextMenu.wallId, 'bar');
              closeContextMenu();
            }}
            className="w-full px-4 py-2 text-left text-sm text-white flex items-center gap-2"
          >
            <span className="w-3 h-3 rounded-full bg-orange-500" />
            Bar
          </button>
          <button
            onClick={() => {
              setWallLabel(contextMenu.wallId, 'entrance');
              closeContextMenu();
            }}
            className="w-full px-4 py-2 text-left text-sm text-white flex items-center gap-2"
          >
            <span className="w-3 h-3 rounded-full bg-green-500" />
            Giriş
          </button>
          <button
            onClick={() => {
              setWallLabel(contextMenu.wallId, 'exit');
              closeContextMenu();
            }}
            className="w-full px-4 py-2 text-left text-sm text-white flex items-center gap-2"
          >
            <span className="w-3 h-3 rounded-full bg-red-500" />
            Çıkış
          </button>
          <button
            onClick={() => {
              setWallLabel(contextMenu.wallId, 'dj');
              closeContextMenu();
            }}
            className="w-full px-4 py-2 text-left text-sm text-white flex items-center gap-2"
          >
            <span className="w-3 h-3 rounded-full bg-purple-500" />
            DJ
          </button>
          <button
            onClick={() => {
              setWallLabel(contextMenu.wallId, 'wc');
              closeContextMenu();
            }}
            className="w-full px-4 py-2 text-left text-sm text-white flex items-center gap-2"
          >
            <span className="w-3 h-3 rounded-full bg-slate-500" />
            WC
          </button>
          <div className="border-t border-slate-600 my-1" />
          <button
            onClick={() => {
              removeWall(contextMenu.wallId);
              closeContextMenu();
            }}
            className="w-full px-4 py-2 text-left text-sm text-red-400 flex items-center gap-2"
          >
            Sil
          </button>
        </div>
      )}
    </div>
  );
}
