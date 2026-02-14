"use client";

import type { GroupLine, GroupLineDrawState } from "../types";
import { CANVAS_WIDTH, CANVAS_HEIGHT, CELL_SIZE } from "../constants";

interface GroupLineRendererProps {
  groupLines: GroupLine[];
  drawState: GroupLineDrawState;
  onDeleteLine: (lineId: string) => void;
  activeTool: "groupLineH" | "groupLineV" | string;
}

export function GroupLineRenderer({
  groupLines,
  drawState,
  onDeleteLine,
  activeTool,
}: GroupLineRendererProps) {
  // Çizim sırasında preview: aktif tool'a göre en yakın grid segment'ini highlight et
  const snapThreshold = CELL_SIZE * 0.4;
  let previewSeg: { x1: number; y1: number; x2: number; y2: number } | null =
    null;

  if (drawState.isDrawing) {
    if (activeTool === "groupLineH") {
      const gridIndex = Math.round(drawState.currentY / CELL_SIZE);
      const gridY = gridIndex * CELL_SIZE;
      if (
        gridIndex > 0 &&
        gridIndex < Math.round(CANVAS_HEIGHT / CELL_SIZE) &&
        Math.abs(drawState.currentY - gridY) < snapThreshold
      ) {
        const segStart = Math.floor(drawState.currentX / CELL_SIZE);
        if (segStart >= 0 && segStart < Math.round(CANVAS_WIDTH / CELL_SIZE)) {
          previewSeg = {
            x1: segStart * CELL_SIZE,
            y1: gridY,
            x2: (segStart + 1) * CELL_SIZE,
            y2: gridY,
          };
        }
      }
    } else if (activeTool === "groupLineV") {
      const gridIndex = Math.round(drawState.currentX / CELL_SIZE);
      const gridX = gridIndex * CELL_SIZE;
      if (
        gridIndex > 0 &&
        gridIndex < Math.round(CANVAS_WIDTH / CELL_SIZE) &&
        Math.abs(drawState.currentX - gridX) < snapThreshold
      ) {
        const segStart = Math.floor(drawState.currentY / CELL_SIZE);
        if (segStart >= 0 && segStart < Math.round(CANVAS_HEIGHT / CELL_SIZE)) {
          previewSeg = {
            x1: gridX,
            y1: segStart * CELL_SIZE,
            x2: gridX,
            y2: (segStart + 1) * CELL_SIZE,
          };
        }
      }
    }
  }

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      style={{ zIndex: 5 }}
    >
      {/* Mevcut segment çizgileri */}
      {groupLines.map((line) => {
        const isHorizontal = line.orientation === "horizontal";
        let x1: number, y1: number, x2: number, y2: number;

        if (isHorizontal) {
          x1 = line.segStart * CELL_SIZE;
          y1 = line.gridIndex * CELL_SIZE;
          x2 = (line.segStart + 1) * CELL_SIZE;
          y2 = line.gridIndex * CELL_SIZE;
        } else {
          x1 = line.gridIndex * CELL_SIZE;
          y1 = line.segStart * CELL_SIZE;
          x2 = line.gridIndex * CELL_SIZE;
          y2 = (line.segStart + 1) * CELL_SIZE;
        }

        return (
          <line
            key={line.id}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={line.color}
            strokeWidth="3"
            strokeLinecap="round"
            className="pointer-events-auto cursor-pointer"
            style={{ filter: `drop-shadow(0 0 4px ${line.color}80)` }}
            onClick={(e) => {
              e.stopPropagation();
              onDeleteLine(line.id);
            }}
          >
            <title>Silmek için tıkla</title>
          </line>
        );
      })}

      {/* Çizim sırasında preview segment */}
      {previewSeg && (
        <line
          x1={previewSeg.x1}
          y1={previewSeg.y1}
          x2={previewSeg.x2}
          y2={previewSeg.y2}
          stroke="#ef4444"
          strokeWidth="3"
          strokeLinecap="round"
          opacity={0.4}
        />
      )}
    </svg>
  );
}
