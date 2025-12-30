"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import {
  Point,
  calculateLassoSelection,
  getCanvasCoordinates,
  clampZoom,
} from "../utils";
import { TableData } from "../types";

export type CanvasTool = "select" | "pan" | "multiSelect";

interface UseCanvasInteractionProps {
  tables: TableData[];
  onSelectionChange?: (tableIds: string[]) => void;
}

interface UseCanvasInteractionReturn {
  // State
  zoom: number;
  offset: Point;
  selectedTableIds: string[];
  activeTool: CanvasTool;
  isLassoSelecting: boolean;
  lassoStart: Point;
  lassoEnd: Point;
  isPanning: boolean;

  // Setters
  setZoom: (zoom: number) => void;
  setOffset: (offset: Point) => void;
  setSelectedTableIds: React.Dispatch<React.SetStateAction<string[]>>;
  setActiveTool: (tool: CanvasTool) => void;

  // Handlers
  handleCanvasMouseDown: (
    e: React.MouseEvent,
    canvasRef: React.RefObject<HTMLDivElement>
  ) => void;
  handleCanvasMouseMove: (
    e: React.MouseEvent,
    canvasRef: React.RefObject<HTMLDivElement>
  ) => void;
  handleCanvasMouseUp: () => void;
  handleTableClick: (
    tableId: string,
    e: React.MouseEvent,
    getTableGroup?: (id: string) => { tableIds: string[] } | undefined
  ) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleResetView: () => void;
  handleSelectAll: () => void;
  handleClearSelection: () => void;

  // Computed
  lassoRect: { minX: number; maxX: number; minY: number; maxY: number } | null;
}

export function useCanvasInteraction({
  tables,
  onSelectionChange,
}: UseCanvasInteractionProps): UseCanvasInteractionReturn {
  // Zoom & Pan state
  const [zoom, setZoomState] = useState(1.0);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

  // Selection state
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");

  // Lasso state
  const [isLassoSelecting, setIsLassoSelecting] = useState(false);
  const [lassoStart, setLassoStart] = useState<Point>({ x: 0, y: 0 });
  const [lassoEnd, setLassoEnd] = useState<Point>({ x: 0, y: 0 });

  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<Point>({ x: 0, y: 0 });

  // Throttle ref
  const lastMouseMoveTime = useRef(0);
  const MOUSE_MOVE_THROTTLE = 16; // ~60fps

  // Lasso just finished ref (prevent click after lasso)
  const lassoJustFinishedRef = useRef(false);

  // Zoom with clamping
  const setZoom = useCallback((newZoom: number) => {
    setZoomState(clampZoom(newZoom));
  }, []);

  // Selection change callback
  const updateSelection = useCallback(
    (newSelection: string[]) => {
      setSelectedTableIds(newSelection);
      onSelectionChange?.(newSelection);
    },
    [onSelectionChange]
  );

  // Canvas mouse down
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent, canvasRef: React.RefObject<HTMLDivElement>) => {
      if (e.button === 2) return; // Right click

      // Check if clicked on a table
      const target = e.target as HTMLElement;
      if (target.closest("[data-table-id]")) {
        return; // Table click handled separately
      }

      // Pan tool
      if (activeTool === "pan") {
        setIsPanning(true);
        panStartRef.current = {
          x: e.clientX - offset.x,
          y: e.clientY - offset.y,
        };
        return;
      }

      // Lasso selection
      if (activeTool === "select" && canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const coords = getCanvasCoordinates(e, canvasRect, offset, zoom);

        setIsLassoSelecting(true);
        setLassoStart(coords);
        setLassoEnd(coords);

        // Clear selection if no modifier key
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          updateSelection([]);
        }
      }
    },
    [activeTool, offset, zoom, updateSelection]
  );

  // Canvas mouse move
  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent, canvasRef: React.RefObject<HTMLDivElement>) => {
      // Throttle
      const now = Date.now();
      if (now - lastMouseMoveTime.current < MOUSE_MOVE_THROTTLE) {
        return;
      }
      lastMouseMoveTime.current = now;

      // Pan
      if (isPanning) {
        setOffset({
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y,
        });
        return;
      }

      // Lasso selection
      if (isLassoSelecting && canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const coords = getCanvasCoordinates(e, canvasRect, offset, zoom);
        setLassoEnd(coords);

        // Calculate selected tables
        const lassoSelectedIds = calculateLassoSelection(
          lassoStart,
          coords,
          tables
        );

        // Update selection
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          setSelectedTableIds((prev) => {
            const newSet = new Set([...prev, ...lassoSelectedIds]);
            return Array.from(newSet);
          });
        } else {
          setSelectedTableIds(lassoSelectedIds);
        }
      }
    },
    [isPanning, isLassoSelecting, offset, zoom, lassoStart, tables]
  );

  // Canvas mouse up
  const handleCanvasMouseUp = useCallback(() => {
    const hadLassoSelection = isLassoSelecting && selectedTableIds.length > 0;

    setIsPanning(false);
    setIsLassoSelecting(false);

    if (hadLassoSelection) {
      lassoJustFinishedRef.current = true;
      setTimeout(() => {
        lassoJustFinishedRef.current = false;
      }, 100);
    }
  }, [isLassoSelecting, selectedTableIds]);

  // Table click
  const handleTableClick = useCallback(
    (
      tableId: string,
      e: React.MouseEvent,
      getTableGroup?: (id: string) => { tableIds: string[] } | undefined
    ) => {
      e.stopPropagation();
      if (lassoJustFinishedRef.current) return;

      // MultiSelect mode - single table toggle
      if (activeTool === "multiSelect") {
        setSelectedTableIds((prev) =>
          prev.includes(tableId)
            ? prev.filter((id) => id !== tableId)
            : [...prev, tableId]
        );
        return;
      }

      // Normal mode - select group if exists
      const group = getTableGroup?.(tableId);
      const idsToSelect = group ? [...group.tableIds] : [tableId];

      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        // Toggle group/table
        setSelectedTableIds((prev) => {
          const allSelected = idsToSelect.every((id) => prev.includes(id));
          if (allSelected) {
            return prev.filter((id) => !idsToSelect.includes(id));
          } else {
            return [...new Set([...prev, ...idsToSelect])];
          }
        });
      } else {
        // Select only this group/table
        setSelectedTableIds(idsToSelect);
      }
    },
    [activeTool]
  );

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom(zoom + 0.1);
  }, [zoom, setZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom(zoom - 0.1);
  }, [zoom, setZoom]);

  const handleResetView = useCallback(() => {
    setZoomState(1.0);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Selection handlers
  const handleSelectAll = useCallback(() => {
    updateSelection(tables.map((t) => t.id));
  }, [tables, updateSelection]);

  const handleClearSelection = useCallback(() => {
    updateSelection([]);
  }, [updateSelection]);

  // Computed lasso rect
  const lassoRect = useMemo(() => {
    if (!isLassoSelecting) return null;
    return {
      minX: Math.min(lassoStart.x, lassoEnd.x),
      maxX: Math.max(lassoStart.x, lassoEnd.x),
      minY: Math.min(lassoStart.y, lassoEnd.y),
      maxY: Math.max(lassoStart.y, lassoEnd.y),
    };
  }, [isLassoSelecting, lassoStart, lassoEnd]);

  return {
    // State
    zoom,
    offset,
    selectedTableIds,
    activeTool,
    isLassoSelecting,
    lassoStart,
    lassoEnd,
    isPanning,

    // Setters
    setZoom,
    setOffset,
    setSelectedTableIds,
    setActiveTool,

    // Handlers
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleTableClick,
    handleZoomIn,
    handleZoomOut,
    handleResetView,
    handleSelectAll,
    handleClearSelection,

    // Computed
    lassoRect,
  };
}
