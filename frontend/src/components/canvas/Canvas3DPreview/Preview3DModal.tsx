"use client";

import React, { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Box, Camera, Maximize2 } from "lucide-react";
import { Canvas3DPreview } from "./index";
import { VenueLayout, CanvasTable } from "@/types";

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
    staffName: string;
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

interface Preview3DModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: VenueLayout;
  tables: CanvasTable[];
  servicePoints?: ServicePoint[];
  tableGroups?: TableGroup[];
  teams?: TeamDefinition[];
  viewMode?: ViewMode;
  eventName?: string;
}

export function Preview3DModal({
  open,
  onOpenChange,
  layout,
  tables,
  servicePoints = [],
  tableGroups = [],
  teams = [],
  viewMode = "default",
  eventName = "Etkinlik",
}: Preview3DModalProps) {
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleTableClick = useCallback((tableId: string) => {
    setSelectedTableIds((prev) =>
      prev.includes(tableId)
        ? prev.filter((id) => id !== tableId)
        : [...prev, tableId]
    );
  }, []);

  const handleScreenshot = useCallback(() => {
    const canvas = document.querySelector("canvas");
    if (canvas) {
      const link = document.createElement("a");
      link.download = `${eventName}-3d-preview.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    }
  }, [eventName]);

  const toggleFullscreen = useCallback(() => {
    const container = document.querySelector("[data-3d-container]");
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-6xl w-[95vw] h-[85vh] p-0 gap-0 bg-slate-950 border-slate-800"
        data-3d-container
      >
        <DialogHeader className="px-6 py-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <Box className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <DialogTitle className="text-white text-lg">
                  3D Mekan Önizleme
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-sm">
                  {eventName} - {tables.length} masa
                </DialogDescription>
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleScreenshot}
                className="text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <Camera className="w-4 h-4 mr-2" />
                Ekran Görüntüsü
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* 3D Canvas */}
        <div className="flex-1 relative">
          <Canvas3DPreview
            layout={layout}
            tables={tables}
            servicePoints={servicePoints}
            tableGroups={tableGroups}
            teams={teams}
            viewMode={viewMode}
            selectedTableIds={selectedTableIds}
          />

          {/* Kontrol ipuçları */}
          <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-sm rounded-lg px-4 py-3 text-sm text-slate-400 border border-slate-700">
            <div className="flex items-center gap-4">
              <span>🖱️ Sol tık + sürükle: Döndür</span>
              <span>🖱️ Sağ tık + sürükle: Kaydır</span>
              <span>🖱️ Scroll: Yakınlaştır</span>
            </div>
          </div>

          {/* Seçili masa bilgisi */}
          {selectedTableIds.length > 0 && (
            <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur-sm rounded-lg px-4 py-3 border border-slate-700">
              <div className="text-sm text-slate-400 mb-1">Seçili Masalar</div>
              <div className="flex flex-wrap gap-2">
                {selectedTableIds.map((id) => {
                  const table = tables.find((t) => t.id === id);
                  return table ? (
                    <span
                      key={id}
                      className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-sm"
                    >
                      {table.label}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}

          {/* İstatistikler */}
          <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-sm rounded-lg px-4 py-3 border border-slate-700">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <div className="text-slate-400">Toplam Masa:</div>
              <div className="text-white font-medium">{tables.length}</div>
              <div className="text-slate-400">Toplam Kapasite:</div>
              <div className="text-white font-medium">
                {tables.reduce((sum, t) => sum + (t.capacity || 0), 0)} kişi
              </div>
              {servicePoints.length > 0 && (
                <>
                  <div className="text-slate-400">Hizmet Noktası:</div>
                  <div className="text-cyan-400 font-medium">
                    {servicePoints.length}
                  </div>
                </>
              )}
              <div className="text-slate-400">Alan:</div>
              <div className="text-white font-medium">
                {(layout.width / 100).toFixed(0)}m x{" "}
                {(layout.height / 100).toFixed(0)}m
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
