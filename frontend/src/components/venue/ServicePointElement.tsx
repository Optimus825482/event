"use client";

import { memo } from "react";
import {
  Wine,
  Coffee,
  UserCheck,
  Star,
  Shield,
  Sparkles,
  Users,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SERVICE_POINT_TYPES } from "./ServicePointModal";

export interface ServicePointData {
  id: string;
  name: string;
  pointType: string;
  requiredStaffCount: number;
  allowedRoles: string[];
  color: string;
  x: number;
  y: number;
  assignedStaffCount?: number;
}

interface ServicePointElementProps {
  servicePoint: ServicePointData;
  isSelected?: boolean;
  onClick?: (id: string, e: React.MouseEvent) => void;
  onDoubleClick?: (id: string) => void;
  onContextMenu?: (id: string, e: React.MouseEvent) => void;
  zoom?: number;
  showLabel?: boolean;
}

// İkon mapping
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  bar: Wine,
  lounge: Star,
  reception: UserCheck,
  vip_area: Sparkles,
  backstage: Shield,
  other: Coffee,
};

export const ServicePointElement = memo(function ServicePointElement({
  servicePoint,
  isSelected = false,
  onClick,
  onDoubleClick,
  onContextMenu,
  zoom = 1,
  showLabel = true,
}: ServicePointElementProps) {
  const Icon = ICON_MAP[servicePoint.pointType] || MapPin;
  const typeConfig = SERVICE_POINT_TYPES.find(
    (t) => t.value === servicePoint.pointType
  );

  const assignedCount = servicePoint.assignedStaffCount || 0;
  const requiredCount = servicePoint.requiredStaffCount;
  const isComplete = assignedCount >= requiredCount;
  const hasPartial = assignedCount > 0 && assignedCount < requiredCount;

  // Boyut hesaplama
  const size = 50; // Kare boyutu
  const scaledSize = size * Math.min(zoom, 1.5);

  return (
    <div
      className={cn(
        "absolute cursor-pointer transition-all duration-200",
        "flex flex-col items-center gap-1",
        isSelected && "z-50"
      )}
      style={{
        left: servicePoint.x,
        top: servicePoint.y,
        transform: `translate(-50%, -50%)`,
      }}
      onClick={(e) => onClick?.(servicePoint.id, e)}
      onDoubleClick={() => onDoubleClick?.(servicePoint.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(servicePoint.id, e);
      }}
    >
      {/* Ana Kare Element */}
      <div
        className={cn(
          "rounded-lg flex items-center justify-center transition-all",
          "border-2 shadow-lg",
          isSelected
            ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110"
            : "hover:scale-105"
        )}
        style={{
          width: scaledSize,
          height: scaledSize,
          backgroundColor: `${servicePoint.color}30`,
          borderColor: servicePoint.color,
          boxShadow: isSelected
            ? `0 0 20px ${servicePoint.color}50`
            : `0 4px 12px ${servicePoint.color}20`,
        }}
      >
        <span style={{ color: servicePoint.color }}>
          <Icon className="w-6 h-6" />
        </span>
      </div>

      {/* İsim Etiketi */}
      {showLabel && (
        <div
          className={cn(
            "px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap",
            "bg-slate-800/90 backdrop-blur-sm border border-slate-700"
          )}
          style={{ color: servicePoint.color }}
        >
          {servicePoint.name}
        </div>
      )}

      {/* Personel Sayısı Badge */}
      <div
        className={cn(
          "absolute -top-1 -right-1 w-5 h-5 rounded-full",
          "flex items-center justify-center text-xs font-bold",
          "border-2 border-slate-900",
          isComplete
            ? "bg-emerald-500 text-white"
            : hasPartial
            ? "bg-amber-500 text-white"
            : "bg-slate-600 text-slate-300"
        )}
        title={`${assignedCount}/${requiredCount} personel atandı`}
      >
        {assignedCount}
      </div>

      {/* Gerekli Personel Göstergesi */}
      <div
        className={cn(
          "absolute -bottom-1 left-1/2 -translate-x-1/2",
          "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full",
          "bg-slate-800/90 backdrop-blur-sm border border-slate-700",
          "text-[10px] font-medium"
        )}
      >
        <Users className="w-3 h-3 text-slate-400" />
        <span className="text-slate-300">
          {assignedCount}/{requiredCount}
        </span>
      </div>
    </div>
  );
});

// Liste görünümü için kompakt kart
export const ServicePointCard = memo(function ServicePointCard({
  servicePoint,
  isSelected = false,
  onClick,
  onEdit,
  onDelete,
}: {
  servicePoint: ServicePointData;
  isSelected?: boolean;
  onClick?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const Icon = ICON_MAP[servicePoint.pointType] || MapPin;
  const assignedCount = servicePoint.assignedStaffCount || 0;
  const requiredCount = servicePoint.requiredStaffCount;
  const isComplete = assignedCount >= requiredCount;

  return (
    <div
      className={cn(
        "p-3 rounded-lg border transition-all cursor-pointer",
        isSelected
          ? "border-cyan-500 bg-cyan-500/10"
          : "border-slate-700 bg-slate-800/50 hover:bg-slate-800"
      )}
      onClick={() => onClick?.(servicePoint.id)}
    >
      <div className="flex items-center gap-3">
        {/* İkon */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${servicePoint.color}20` }}
        >
          <span style={{ color: servicePoint.color }}>
            <Icon className="w-5 h-5" />
          </span>
        </div>

        {/* Bilgiler */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {servicePoint.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: `${servicePoint.color}20`,
                color: servicePoint.color,
              }}
            >
              {SERVICE_POINT_TYPES.find(
                (t) => t.value === servicePoint.pointType
              )?.label || servicePoint.pointType}
            </span>
            <span
              className={cn(
                "text-xs flex items-center gap-1",
                isComplete ? "text-emerald-400" : "text-amber-400"
              )}
            >
              <Users className="w-3 h-3" />
              {assignedCount}/{requiredCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
