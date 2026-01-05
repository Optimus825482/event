"use client";

import { Lock } from "lucide-react";
import type { StageElement, CanvasTool } from "../types";
import { AREA_ICONS, SIZE_OPTIONS, FONT_OPTIONS } from "../constants";

interface StageElementRendererProps {
  stage: StageElement;
  isSelected: boolean;
  activeTool: CanvasTool;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onDoubleClick: (id: string) => void;
  onResizeMouseDown: (
    e: React.MouseEvent,
    id: string,
    edge: "right" | "bottom" | "corner" | "left" | "top"
  ) => void;
}

export function StageElementRenderer({
  stage,
  isSelected,
  activeTool,
  onMouseDown,
  onContextMenu,
  onDoubleClick,
  onResizeMouseDown,
}: StageElementRendererProps) {
  const iconConfig = AREA_ICONS.find((i) => i.id === stage.iconId);
  const IconComponent = iconConfig?.icon;
  const sizeConfig =
    SIZE_OPTIONS.find((s) => s.id === (stage.fontSize || "md")) ||
    SIZE_OPTIONS[1];
  const fontConfig =
    FONT_OPTIONS.find((f) => f.id === (stage.fontFamily || "sans")) ||
    FONT_OPTIONS[0];

  const bgColor =
    stage.color || (stage.type === "stage" ? "#dc2626" : "#3b82f6");
  const borderClr =
    stage.borderColor || (stage.type === "stage" ? "#f87171" : "#60a5fa");
  const borderW = stage.borderWidth || 2;
  const isVertical =
    stage.textDirection === "vertical-down" ||
    stage.textDirection === "vertical-up";
  const isVerticalUp = stage.textDirection === "vertical-up";

  return (
    <div
      className={`absolute select-none transition-all group ${
        isSelected
          ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900"
          : ""
      } ${stage.isLocked ? "opacity-90" : ""}`}
      style={{
        left: stage.x,
        top: stage.y,
        width: stage.width,
        height: stage.height,
        cursor: stage.isLocked
          ? "not-allowed"
          : activeTool === "select"
          ? "move"
          : "default",
      }}
      onMouseDown={(e) => onMouseDown(e, stage.id)}
      onContextMenu={(e) => onContextMenu(e, stage.id)}
      onDoubleClick={() => onDoubleClick(stage.id)}
      title={stage.label}
    >
      <div
        className={`w-full h-full rounded flex items-center justify-center gap-1 text-white font-bold shadow-lg ${
          fontConfig.className
        } ${isVertical ? "flex-col" : "flex-row"}`}
        style={{
          backgroundColor: `${bgColor}cc`,
          borderColor: borderClr,
          borderWidth: `${borderW}px`,
          borderStyle: "solid",
        }}
      >
        {/* Kilit ikonu */}
        {stage.isLocked && (
          <div className="absolute top-1 left-1">
            <Lock className="w-3 h-3 text-white/70" />
          </div>
        )}
        {/* İkon */}
        {IconComponent && <IconComponent className={sizeConfig.iconClass} />}
        {/* Metin */}
        <span
          className={sizeConfig.textClass}
          style={
            isVertical
              ? {
                  writingMode: "vertical-rl",
                  textOrientation: "mixed",
                  transform: isVerticalUp ? "rotate(180deg)" : undefined,
                }
              : undefined
          }
        >
          {stage.displayText || ""}
        </span>
      </div>

      {/* Resize Handles */}
      {isSelected && activeTool === "select" && !stage.isLocked && (
        <>
          <div
            className="absolute top-1/2 -translate-y-1/2 -right-1 w-2 h-8 bg-white rounded cursor-ew-resize hover:bg-blue-400 transition-colors"
            onMouseDown={(e) => onResizeMouseDown(e, stage.id, "right")}
          />
          <div
            className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-8 h-2 bg-white rounded cursor-ns-resize hover:bg-blue-400 transition-colors"
            onMouseDown={(e) => onResizeMouseDown(e, stage.id, "bottom")}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-8 bg-white rounded cursor-ew-resize hover:bg-blue-400 transition-colors"
            onMouseDown={(e) => onResizeMouseDown(e, stage.id, "left")}
          />
          <div
            className="absolute left-1/2 -translate-x-1/2 -top-1 w-8 h-2 bg-white rounded cursor-ns-resize hover:bg-blue-400 transition-colors"
            onMouseDown={(e) => onResizeMouseDown(e, stage.id, "top")}
          />
          <div
            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white rounded-sm cursor-nwse-resize hover:bg-blue-400 transition-colors"
            onMouseDown={(e) => onResizeMouseDown(e, stage.id, "corner")}
          />
        </>
      )}
    </div>
  );
}
